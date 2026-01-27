import EventEmitter from 'events';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageStreamEvents } from '@anthropic-ai/sdk/lib/MessageStream';

import { JSON_RESPONSE_INSTRUCTION, BUILT_IN_MODEL_PREFIX } from '@sre/constants';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import {
    ToolData,
    TLLMMessageBlock,
    TLLMToolResultMessageBlock,
    TLLMMessageRole,
    APIKeySource,
    TLLMEvent,
    ILLMRequestFuncParams,
    TLLMChatResponse,
    BasicCredentials,
    TAnthropicRequestBody,
    ILLMRequestContext,
    TLLMPreparedParams,
} from '@sre/types/LLM.types';

import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { JSONContent } from '@sre/helpers/JsonContent.helper';

import { LLMConnector } from '../LLMConnector';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { SUPPORTED_MIME_TYPES_MAP } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { hookAsync } from '@sre/Core/HookService';

const logger = Logger('AnthropicConnector');

const PREFILL_TEXT_FOR_JSON_RESPONSE = '{';
const LEGACY_THINKING_MODELS = ['smythos/claude-3.7-sonnet-thinking', 'claude-3.7-sonnet-thinking'];

// Type aliases
type AnthropicMessageParams = Anthropic.MessageCreateParamsNonStreaming | Anthropic.Messages.MessageStreamParams;
type AnthropicStreamEventType = keyof MessageStreamEvents;

// Event names automatically validated against MessageStreamEvents type
// TypeScript will error if any events are missing or incorrect
// This ensures we always use the correct event names as defined by Anthropic SDK
const AnthropicStreamEvent = {
    connect: 'connect',
    streamEvent: 'streamEvent',
    text: 'text',
    citation: 'citation',
    inputJson: 'inputJson',
    thinking: 'thinking',
    signature: 'signature',
    message: 'message',
    contentBlock: 'contentBlock',
    finalMessage: 'finalMessage',
    error: 'error',
    abort: 'abort',
    end: 'end',
} satisfies Record<keyof MessageStreamEvents, AnthropicStreamEventType>;

// TODO [Forhad]: implement proper typing

export class AnthropicConnector extends LLMConnector {
    public name = 'LLM:Anthropic';

    private validImageMimeTypes = SUPPORTED_MIME_TYPES_MAP.Anthropic.image;

    private async getClient(params: ILLMRequestContext): Promise<Anthropic> {
        const apiKey = (params.credentials as BasicCredentials)?.apiKey;

        if (!apiKey) throw new Error('Please provide an API key for Anthropic');

        return new Anthropic({ apiKey });
    }

    @hookAsync('LLMConnector.request')
    protected async request({ acRequest, body, context }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        try {
            logger.debug(`request ${this.name}`, acRequest.candidate);
            const anthropic = await this.getClient(context);
            const result = await anthropic.messages.create(body);
            const message: Anthropic.MessageParam = {
                role: (result?.role || TLLMMessageRole.User) as Anthropic.MessageParam['role'],
                content: result?.content || '',
            };
            const stopReason = result?.stop_reason;

            let toolsData: ToolData[] = [];
            let useTool = false;

            if ((stopReason as 'tool_use') === 'tool_use') {
                const toolUseContentBlocks = result?.content?.filter((c) => (c.type as 'tool_use') === 'tool_use');

                if (toolUseContentBlocks?.length === 0) return;

                toolUseContentBlocks.forEach((toolUseBlock: Anthropic.Messages.ToolUseBlock, index) => {
                    toolsData.push({
                        index,
                        id: toolUseBlock?.id,
                        type: 'function', // We call API only when the tool type is 'function' in `src/helpers/Conversation.helper.ts`. Even though Anthropic returns the type as 'tool_use', it should be interpreted as 'function'.
                        name: toolUseBlock?.name,
                        arguments: toolUseBlock?.input,
                        role: result?.role,
                    });
                });

                useTool = true;
            }

            const textBlock = result?.content?.find((block) => block.type === 'text');
            let content = textBlock?.text || '';

            const usage = result?.usage;

            if (this.hasPrefillText(body.messages)) {
                content = `${PREFILL_TEXT_FOR_JSON_RESPONSE}${content}`;
            }

            this.reportUsage(usage, {
                modelEntryName: context.modelEntryName,
                keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId: context.agentId,
                teamId: context.teamId,
            });

            return {
                content,
                finishReason: result?.stop_reason,
                useTool,
                toolsData,
                message,
                usage,
            };
        } catch (error) {
            logger.error(`request ${this.name}`, error, acRequest.candidate);
            throw error;
        }
    }

    @hookAsync('LLMConnector.streamRequest')
    protected async streamRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        try {
            logger.debug(`streamRequest ${this.name}`, acRequest.candidate);
            const emitter = new EventEmitter();
            const usage_data = [];

            const anthropic = await this.getClient(context);
            let stream = anthropic.messages.stream(body);

            let toolsData: ToolData[] = [];
            let thinkingBlocks: any[] = []; // To preserve thinking blocks

            // Determine if we need to inject prefill text and track if it's been injected
            const needsPrefillInjection = this.hasPrefillText(body.messages);
            let prefillInjected = false;

            stream.on(AnthropicStreamEvent.streamEvent, (event: any) => {
                if (event.message?.usage) {
                    //console.log('usage', event.message?.usage);
                }
            });

            stream.on(AnthropicStreamEvent.error, (error) => {
                //console.log('error', error);

                emitter.emit(TLLMEvent.Error, error);
            });

            stream.on(AnthropicStreamEvent.message, (message) => {
                emitter.emit(TLLMEvent.Data, message);
            });

            stream.on(AnthropicStreamEvent.text, (text: string) => {
                // Inject prefill text only once at the very beginning if needed
                if (needsPrefillInjection && !prefillInjected) {
                    text = `${PREFILL_TEXT_FOR_JSON_RESPONSE}${text}`;
                    prefillInjected = true;
                }

                emitter.emit(TLLMEvent.Content, text);
            });

            stream.on(AnthropicStreamEvent.thinking, (thinking) => {
                // Handle thinking blocks during streaming
                emitter.emit(TLLMEvent.Thinking, thinking);
            });

            stream.on(AnthropicStreamEvent.finalMessage, (finalMessage) => {
                let finishReason = 'stop';
                // Preserve thinking blocks for subsequent tool interactions
                thinkingBlocks = finalMessage.content.filter((block) => block.type === 'thinking' || block.type === 'redacted_thinking');

                // Process tool use blocks
                const toolUseContentBlocks = finalMessage.content.filter((c) => c.type === 'tool_use');

                if (toolUseContentBlocks?.length > 0) {
                    toolUseContentBlocks.forEach((toolUseBlock: Anthropic.Messages.ToolUseBlock, index) => {
                        toolsData.push({
                            index,
                            id: toolUseBlock?.id,
                            type: 'function', // We call API only when the tool type is 'function' in `src/helpers/Conversation.helper.ts`. Even though Anthropic returns the type as 'tool_use', it should be interpreted as 'function'.
                            name: toolUseBlock?.name,
                            arguments: toolUseBlock?.input,
                            role: finalMessage?.role,
                        });
                    });

                    emitter.emit(TLLMEvent.ToolInfo, toolsData, thinkingBlocks);
                } else {
                    finishReason = finalMessage.stop_reason;
                }

                if (finalMessage?.usage) {
                    const usage = finalMessage.usage;

                    const reportedUsage = this.reportUsage(usage, {
                        modelEntryName: context.modelEntryName,
                        keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                        agentId: context.agentId,
                        teamId: context.teamId,
                    });

                    usage_data.push(reportedUsage);
                }
                if (finishReason !== 'stop' && finishReason !== 'end_turn') {
                    emitter.emit(TLLMEvent.Interrupted, finishReason);
                }

                //only emit end event after processing the final message
                setTimeout(() => {
                    emitter.emit(TLLMEvent.End, toolsData, usage_data, finishReason);
                }, 100);
            });

            return emitter;
        } catch (error: any) {
            logger.error(`streamRequest ${this.name}`, error, acRequest.candidate);
            throw error;
        }
    }

    protected async reqBodyAdapter(params: TLLMPreparedParams): Promise<TAnthropicRequestBody> {
        const body = await this.prepareBody(params);

        const shouldUseThinking = await this.shouldUseThinkingMode(params);
        if (shouldUseThinking) {
            return await this.prepareBodyForThinkingRequest({
                body,
                maxThinkingTokens: params.maxThinkingTokens,
                toolChoice: params?.toolsConfig?.tool_choice as unknown as Anthropic.ToolChoice,
            });
        }

        return body;
    }

    protected reportUsage(
        usage: Anthropic.Messages.Usage & { cache_creation_input_tokens?: number; cache_read_input_tokens?: number },
        metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }
    ) {
        // SmythOS (built-in) models have a prefix, so we need to remove it to get the model name
        const modelName = metadata.modelEntryName.replace(BUILT_IN_MODEL_PREFIX, '');

        const usageData = {
            sourceId: `llm:${modelName}`,
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
            input_tokens_cache_write: usage.cache_creation_input_tokens,
            input_tokens_cache_read: usage.cache_read_input_tokens,
            keySource: metadata.keySource,
            agentId: metadata.agentId,
            teamId: metadata.teamId,
        };
        SystemEvents.emit('USAGE:LLM', usageData);

        return usageData;
    }

    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto' }) {
        let tools: {
            name: string;
            description: string;
            input_schema: {
                type: 'object';
                properties: Record<string, unknown>;
                required: string[];
            };
        }[] = [];

        if (type === 'function') {
            tools = toolDefinitions.map((tool) => {
                const { name, description, properties, requiredFields } = tool;

                return {
                    name,
                    description,
                    input_schema: {
                        type: 'object',
                        properties,
                        required: requiredFields,
                    },
                };
            });
        }

        return tools?.length > 0 ? { tools } : {};
    }

    public transformToolMessageBlocks({
        messageBlock,
        toolsData,
    }: {
        messageBlock: TLLMMessageBlock & { thinkingBlocks?: { type: string; thinking: string }[] };
        toolsData: ToolData[];
    }): TLLMToolResultMessageBlock[] {
        const messageBlocks: TLLMToolResultMessageBlock[] = [];

        if (messageBlock) {
            const content: any[] = []; // TODO: set proper type for content

            if (messageBlock.thinkingBlocks?.length > 0) {
                content.push(...messageBlock.thinkingBlocks);
            }

            if (Array.isArray(messageBlock.content)) {
                content.push(...messageBlock.content);
            } else {
                if (messageBlock.content) {
                    //Anthropic does not accept empty text blocks
                    content.push({ type: 'text', text: messageBlock.content });
                }
            }
            if (messageBlock.tool_calls) {
                const calls = messageBlock.tool_calls.map((toolCall: any) => {
                    const args = toolCall?.function?.arguments;
                    return {
                        type: 'tool_use',
                        id: toolCall.id,
                        name: toolCall?.function?.name,
                        input: typeof args === 'string' ? JSONContent(args || '{}').tryParse() : args || {},
                    };
                });

                content.push(...calls);
            }

            messageBlocks.push({
                role: messageBlock?.role,
                content: content,
            });
        }

        // Combine all tool results into a single user message
        const toolResultsContent = toolsData.map((toolData): any => ({
            type: 'tool_result',
            tool_use_id: toolData.id,
            content: toolData.result,
        }));

        if (toolResultsContent.length > 0) {
            messageBlocks.push({
                role: TLLMMessageRole.User,
                content: toolResultsContent,
            });
        }

        return messageBlocks;
    }

    // TODO [Forhad]: This method is quite lengthy and complex. Consider breaking it down into smaller, more manageable functions for better readability and maintainability.
    public getConsistentMessages(messages) {
        let _messages = JSON.parse(JSON.stringify(messages));

        // Extract the system message from the start, as our logic expects 'user' to be the first message for checks and fixes. We will add it back later.
        let systemMessage = null;
        if (_messages[0]?.role === TLLMMessageRole.System) {
            systemMessage = _messages.shift();
        }

        _messages = LLMHelper.removeDuplicateUserMessages(_messages);

        _messages = _messages.map((message) => {
            let content;

            if (message?.parts) {
                content = message.parts.map((textBlock) => textBlock?.text || '').join(' ');
            } else if (Array.isArray(message?.content)) {
                if (Array.isArray(message.content)) {
                    const toolBlocks = message.content.filter(
                        (item) => typeof item === 'object' && 'type' in item && (item.type === 'tool_use' || item.type === 'tool_result')
                    );

                    if (toolBlocks?.length > 0) {
                        content = message.content.map((item) => {
                            if (item.type === 'text' && (!item.text || item.text.trim() === '')) {
                                return { ...item, text: '...' }; // empty text causes error that's why we added '...'
                            }
                            return item;
                        });
                    } else {
                        content = message.content
                            .map((block) => block?.text || '')
                            .join(' ')
                            .trim();
                    }
                } else {
                    content = message.content;
                }
            } else if (message?.content) {
                content = message.content as string;
            }

            message.content = content || '...'; // empty content causes error that's why we added '...'

            return message;
        });

        //[FIXED] - `tool_result` block(s) provided when previous message does not contain any `tool_use` blocks" (handler)
        if (_messages[0]?.role === TLLMMessageRole.User && Array.isArray(_messages[0].content)) {
            const hasToolResult = _messages[0].content.find((content) => 'type' in content && content.type === 'tool_result');

            //we found a tool result in the first message, so we need to remove the user message
            if (hasToolResult) {
                _messages.shift();
            }
        }

        // - Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"messages: first message must use the \"user\" role"}}
        if (_messages[0]?.role !== TLLMMessageRole.User) {
            _messages.unshift({ role: TLLMMessageRole.User, content: 'continue' }); //add an empty user message to keep the consistency
        }

        // Add the system message back to the start, as we extracted it earlier
        // Empty content is not allowed in Anthropic
        if (systemMessage && systemMessage.content) {
            _messages.unshift(systemMessage);
        }

        return _messages;
    }

    private async prepareBody(params: TLLMPreparedParams): Promise<Anthropic.MessageCreateParamsNonStreaming> {
        let messages = await this.prepareMessages(params);

        let body: Anthropic.MessageCreateParamsNonStreaming = {
            model: params.model as string,
            messages: messages as Anthropic.MessageParam[],
            max_tokens: params.maxTokens, // * max token is required
        };

        //#region Prepare system message and add JSON response instruction if needed
        // TODO: We have better parameter to have structured response, need to implement it.
        const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(messages);
        if ('content' in systemMessage) {
            body.system = systemMessage?.content as string;
        }
        messages = otherMessages;

        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            body.system = body.system ? `${body.system} ${JSON_RESPONSE_INSTRUCTION}` : JSON_RESPONSE_INSTRUCTION;

            messages.push({ role: TLLMMessageRole.Assistant, content: PREFILL_TEXT_FOR_JSON_RESPONSE });
        }

        const hasSystemMessage = LLMHelper.hasSystemMessage(messages);
        if (hasSystemMessage) {
            // in Anthropic we need to provide system message separately
            const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(messages);

            if ('content' in systemMessage) {
                body.system = await this.prepareSystemPrompt(systemMessage, params);
            }

            messages = otherMessages as Anthropic.MessageParam[];
        }
        //#endregion Prepare system message and add JSON response instruction if needed

        // Temperature and top_p are mutually exclusive for Anthropic API.
        // Temperature takes precedence. Guard ensures only one is ever set.
        if (params?.temperature !== undefined && params.temperature >= 0) {
            body.temperature = params.temperature;
            delete body.top_p;
        } else if (params?.topP !== undefined && params.topP >= 0) {
            body.top_p = params.topP;
            delete body.temperature;
        }

        if (params?.topK !== undefined) body.top_k = params.topK;
        if (params?.stopSequences?.length) body.stop_sequences = params.stopSequences;

        // #region Tools
        if (params?.toolsConfig?.tools && params?.toolsConfig?.tools.length > 0) {
            body.tools = params?.toolsConfig?.tools as unknown as Anthropic.Tool[];

            if (params?.cache) {
                body.tools[body.tools.length - 1]['cache_control'] = { type: 'ephemeral' };
            }
        }

        const toolChoice = params?.toolsConfig?.tool_choice as unknown as Anthropic.ToolChoice;
        if (toolChoice) {
            body.tool_choice = toolChoice;
        }
        // #endregion Tools

        body.messages = messages as Anthropic.MessageParam[];
        return body;
    }

    private async prepareBodyForThinkingRequest({
        body,
        maxThinkingTokens,
        toolChoice = null,
    }: {
        body: AnthropicMessageParams;
        maxThinkingTokens: number;
        toolChoice?: Anthropic.ToolChoice;
    }): Promise<Anthropic.MessageCreateParamsNonStreaming> {
        // Remove the assistant message with the prefill text for JSON response, it's not supported with thinking
        let messages = body.messages.filter(
            (message) => !(message?.role === TLLMMessageRole.Assistant && message?.content === PREFILL_TEXT_FOR_JSON_RESPONSE)
        );

        let budget_tokens = Math.min(maxThinkingTokens, body.max_tokens);

        // If budget_tokens is equal to max_tokens, we set it to 80% of max_tokens
        // to avoid the error: "budget_tokens must be less than max_tokens".
        //
        // Another way to ensure valid budget_tokens is to add max_tokens and budget_tokens together - max_tokens = max_tokens + budget_tokens,
        // then take the minimum, like: Math.min(max_tokens, allowedMaxTokens).
        // However, this approach requires additional information such as model details,
        // which would mean adding more arguments like acRequest and modelEntryName to get allowedMaxTokens.
        //
        // So for now, to keep it simple, if max_tokens equals budget_tokens,
        // just use 80% of max_tokens.

        if (budget_tokens === body.max_tokens) {
            budget_tokens = Math.floor(budget_tokens * 0.8);
        }

        const thinkingBody: Anthropic.MessageCreateParamsNonStreaming = {
            model: body.model,
            messages,
            max_tokens: body.max_tokens,
            thinking: {
                type: 'enabled',
                budget_tokens,
            },
        };

        if (toolChoice) {
            // any and tool are not supported with thinking, so we set it to auto
            if (['any', 'tool'].includes(toolChoice.type)) {
                thinkingBody.tool_choice = {
                    type: 'auto',
                };
            } else {
                thinkingBody.tool_choice = toolChoice;
            }
        }

        return thinkingBody;
    }

    private async prepareMessages(params: TLLMPreparedParams) {
        const messages = params?.messages || [];

        const files: BinaryInput[] = params?.files || [];

        if (files?.length > 0) {
            // #region Upload files
            const promises = [];
            const _files = [];

            for (let image of files) {
                const binaryInput = BinaryInput.from(image);
                promises.push(binaryInput.upload(AccessCandidate.agent(params.agentId)));

                _files.push(binaryInput);
            }

            await Promise.all(promises);
            // #endregion Upload files

            const validSources = this.getValidImageFiles(_files);
            const imageData = await this.getImageData(validSources, params.agentId);

            const userMessage = Array.isArray(messages) ? messages.pop() : {};
            const prompt = userMessage?.content || '';

            const content = [{ type: 'text', text: prompt }, ...imageData];
            messages.push({ role: TLLMMessageRole.User, content });
        }

        return messages;
    }

    private async prepareSystemPrompt(
        systemMessage: TLLMMessageBlock,
        params: TLLMPreparedParams
    ): Promise<string | Array<Anthropic.TextBlockParam>> {
        let systemPrompt = systemMessage?.content;

        if (typeof systemPrompt === 'string') {
            systemPrompt = [
                {
                    type: 'text' as const,
                    text: systemPrompt,
                    //cache_control: { type: 'ephemeral' }, //TODO: @Forhad check this
                },
            ] as Array<Anthropic.TextBlockParam>;
        }

        (systemPrompt as Array<Anthropic.TextBlockParam>).unshift({
            type: 'text' as const,
            text: 'If you need to call a function, Do NOT inform the user that you are about to do so, and do not thank the user after you get the response. Just say something like "Give me a moment...", then when you get the response, Just continue answering the user without saying anything about the function you just called',
        });

        if (params?.cache) {
            (systemPrompt as Array<Anthropic.TextBlockParam>)[systemPrompt.length - 1]['cache_control'] = { type: 'ephemeral' };
        }

        return systemPrompt as Array<Anthropic.TextBlockParam>;
    }

    /**
     * Determines if thinking mode should be used based on model capabilities and parameters.
     */
    private async shouldUseThinkingMode(params: TLLMPreparedParams): Promise<boolean> {
        // Legacy thinking models always use thinking mode
        if (LEGACY_THINKING_MODELS.includes(params.modelEntryName)) {
            return true;
        }

        // Check if reasoning is explicitly requested and model supports it
        const useReasoning = params?.useReasoning && params.capabilities?.reasoning === true;

        return useReasoning;
    }

    private getValidImageFiles(files: BinaryInput[]) {
        const validSources = [];

        for (let file of files) {
            if (this.validImageMimeTypes.includes(file?.mimetype)) {
                validSources.push(file);
            }
        }

        if (validSources?.length === 0) {
            throw new Error(`Unsupported file(s). Please make sure your file is one of the following types: ${this.validImageMimeTypes.join(', ')}`);
        }

        return validSources;
    }

    private async getImageData(
        files: BinaryInput[],
        agentId: string
    ): Promise<
        {
            type: string;
            source: { type: 'base64'; data: string; media_type: string };
        }[]
    > {
        try {
            const imageData = [];

            for (let file of files) {
                const bufferData = await file.readData(AccessCandidate.agent(agentId));
                const base64Data = bufferData.toString('base64');

                imageData.push({
                    type: 'image',
                    source: {
                        type: 'base64',
                        data: base64Data,
                        media_type: file.mimetype,
                    },
                });
            }

            return imageData;
        } catch (error) {
            throw error;
        }
    }

    private hasPrefillText(messages: Anthropic.MessageParam[]) {
        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];

            if (message?.role === TLLMMessageRole.Assistant && message?.content === PREFILL_TEXT_FOR_JSON_RESPONSE) {
                return true;
            }
        }

        return false;
    }
}
