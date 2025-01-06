import EventEmitter from 'events';
import Anthropic from '@anthropic-ai/sdk';

import Agent from '@sre/AgentManager/Agent.class';
import { JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { TLLMParams, ToolData, TLLMMessageBlock, TLLMToolResultMessageBlock, TLLMMessageRole } from '@sre/types/LLM.types';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { JSONContent } from '@sre/helpers/JsonContent.helper';

import { ImagesResponse, LLMChatResponse, LLMConnector } from '../LLMConnector';
import { TextBlockParam } from '@anthropic-ai/sdk/resources';

const console = Logger('AnthropicConnector');

const VALID_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const PREFILL_TEXT_FOR_JSON_RESPONSE = '{';
const TOOL_USE_DEFAULT_MODEL = 'claude-3-5-haiku-latest';
const API_KEY_ERROR_MESSAGE = 'Please provide an API key for Anthropic';

// TODO [Forhad]: implement proper typing

export class AnthropicConnector extends LLMConnector {
    public name = 'LLM:Anthropic';

    private validImageMimeTypes = VALID_IMAGE_MIME_TYPES;

    protected async chatRequest(acRequest: AccessRequest, params: TLLMParams): Promise<LLMChatResponse> {
        let messages = params?.messages || [];

        //#region Separate system message and add JSON response instruction if needed
        let systemPrompt = '';
        const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(messages);
        if ('content' in systemMessage) {
            systemPrompt = systemMessage?.content as string;
        }
        messages = otherMessages;

        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            systemPrompt += JSON_RESPONSE_INSTRUCTION;

            messages.push({ role: TLLMMessageRole.Assistant, content: PREFILL_TEXT_FOR_JSON_RESPONSE });
        }
        //#endregion Separate system message and add JSON response instruction if needed

        const apiKey = params?.credentials?.apiKey;

        // We do not provide default API key for claude, so user/team must provide their own API key
        if (!apiKey) throw new Error(API_KEY_ERROR_MESSAGE);

        const anthropic = new Anthropic({ apiKey });

        // TODO: implement claude specific token counting to validate token limit
        // this.validateTokenLimit(params);

        const messageCreateArgs: Anthropic.MessageCreateParamsNonStreaming = {
            model: params.model,
            messages: messages as Anthropic.MessageParam[],
            max_tokens: params?.maxTokens || LLMRegistry.getMaxCompletionTokens(params?.model, !!apiKey), // * max token is required
        };

        if (systemPrompt) messageCreateArgs.system = systemPrompt;

        if (params?.temperature !== undefined) messageCreateArgs.temperature = params.temperature;
        if (params?.topP !== undefined) messageCreateArgs.top_p = params.topP;
        if (params?.topK !== undefined) messageCreateArgs.top_k = params.topK;
        if (params?.stopSequences?.length) messageCreateArgs.stop_sequences = params.stopSequences;

        try {
            const response = await anthropic.messages.create(messageCreateArgs);
            let content = (response.content?.[0] as Anthropic.TextBlock)?.text;
            const finishReason = response?.stop_reason;

            if (responseFormat === 'json') {
                content = `${PREFILL_TEXT_FOR_JSON_RESPONSE}${content}`;
            }

            return { content, finishReason };
        } catch (error) {
            throw error;
        }
    }

    // TODO [Forhad]: check if we can get the agent ID from the acRequest.candidate
    protected async visionRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent?: string | Agent) {
        let messages = params?.messages || [];

        const agentId = agent instanceof Agent ? agent.id : agent;

        const fileSources: BinaryInput[] = params?.fileSources || []; // Assign fileSource from the original parameters to avoid overwriting the original constructor
        const validSources = this.getValidImageFileSources(fileSources);
        const imageData = await this.getImageData(validSources, agentId);

        const content = [{ type: 'text', text: prompt }, ...imageData];
        messages.push({ role: TLLMMessageRole.User, content });

        //#region Separate system message and add JSON response instruction if needed
        let systemPrompt;
        const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(messages);
        if ('content' in systemMessage) {
            systemPrompt = (systemMessage as TLLMMessageBlock)?.content;
        }
        messages = otherMessages;

        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            systemPrompt += JSON_RESPONSE_INSTRUCTION;
            messages.push({ role: TLLMMessageRole.Assistant, content: PREFILL_TEXT_FOR_JSON_RESPONSE });
        }
        //#endregion Separate system message and add JSON response instruction if needed

        const apiKey = params?.credentials?.apiKey;

        // We do not provide default API key for claude, so user/team must provide their own API key
        if (!apiKey) throw new Error(API_KEY_ERROR_MESSAGE);

        const anthropic = new Anthropic({ apiKey });

        // TODO (Forhad): implement claude specific token counting properly
        // this.validateTokenLimit(params);

        const messageCreateArgs: Anthropic.MessageCreateParamsNonStreaming = {
            model: params.model,
            messages,
            max_tokens: params?.maxTokens || LLMRegistry.getMaxCompletionTokens(params?.model, !!apiKey), // * max token is required
        };

        if (params?.temperature !== undefined) messageCreateArgs.temperature = params.temperature;
        if (params?.topP !== undefined) messageCreateArgs.top_p = params.topP;
        if (params?.topK !== undefined) messageCreateArgs.top_k = params.topK;
        if (params?.stopSequences?.length) messageCreateArgs.stop_sequences = params.stopSequences;

        try {
            const response = await anthropic.messages.create(messageCreateArgs);
            let content = (response?.content?.[0] as Anthropic.TextBlock)?.text;
            const finishReason = response?.stop_reason;

            return { content, finishReason };
        } catch (error) {
            throw error;
        }
    }

    protected async multimodalRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent?: string | Agent): Promise<LLMChatResponse> {
        let messages = params?.messages || [];

        const agentId = agent instanceof Agent ? agent.id : agent;

        const fileSources: BinaryInput[] = params?.fileSources || []; // Assign fileSource from the original parameters to avoid overwriting the original constructor
        const validSources = this.getValidImageFileSources(fileSources);
        const imageData = await this.getImageData(validSources, agentId);

        const content = [{ type: 'text', text: prompt }, ...imageData];
        messages.push({ role: TLLMMessageRole.User, content });

        //#region Separate system message and add JSON response instruction if needed
        let systemPrompt;
        const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(messages);
        if ('content' in systemMessage) {
            systemPrompt = (systemMessage as TLLMMessageBlock)?.content;
        }
        messages = otherMessages;

        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            systemPrompt += JSON_RESPONSE_INSTRUCTION;
            messages.push({ role: TLLMMessageRole.Assistant, content: PREFILL_TEXT_FOR_JSON_RESPONSE });
        }
        //#endregion Separate system message and add JSON response instruction if needed

        const apiKey = params?.credentials?.apiKey;

        // We do not provide default API key for claude, so user/team must provide their own API key
        if (!apiKey) throw new Error(API_KEY_ERROR_MESSAGE);

        const anthropic = new Anthropic({ apiKey });

        // TODO (Forhad): implement claude specific token counting properly
        // this.validateTokenLimit(params);

        const messageCreateArgs: Anthropic.MessageCreateParamsNonStreaming = {
            model: params.model,
            messages,
            max_tokens: params?.maxTokens || LLMRegistry.getMaxCompletionTokens(params?.model, !!apiKey), // * max token is required
        };

        if (params?.temperature !== undefined) messageCreateArgs.temperature = params.temperature;
        if (params?.topP !== undefined) messageCreateArgs.top_p = params.topP;
        if (params?.topK !== undefined) messageCreateArgs.top_k = params.topK;
        if (params?.stopSequences?.length) messageCreateArgs.stop_sequences = params.stopSequences;

        try {
            const response = await anthropic.messages.create(messageCreateArgs);
            let content = (response?.content?.[0] as Anthropic.TextBlock)?.text;
            const finishReason = response?.stop_reason;

            return { content, finishReason };
        } catch (error) {
            throw error;
        }
    }

    protected async toolRequest(acRequest: AccessRequest, params: TLLMParams): Promise<any> {
        try {
            const apiKey = params?.credentials?.apiKey;

            // We do not provide default API key for claude, so user/team must provide their own API key
            if (!apiKey) throw new Error(API_KEY_ERROR_MESSAGE);

            const anthropic = new Anthropic({ apiKey });

            const messageCreateArgs: Anthropic.MessageCreateParamsNonStreaming = {
                model: params?.model,
                messages: [],
                max_tokens: params?.maxTokens || LLMRegistry.getMaxCompletionTokens(params?.model, !!apiKey), // * max token is required
            };

            let messages = params?.messages || [];

            const hasSystemMessage = LLMHelper.hasSystemMessage(messages);
            if (hasSystemMessage) {
                // in Anthropic we need to provide system message separately
                const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(messages);

                messageCreateArgs.system = ((systemMessage as TLLMMessageBlock)?.content as string) || '';

                messages = otherMessages as Anthropic.MessageParam[];
            }

            messageCreateArgs.messages = messages;

            if (params?.toolsConfig?.tools && params?.toolsConfig?.tools.length > 0) {
                messageCreateArgs.tools = params?.toolsConfig?.tools as Anthropic.Tool[];
            }

            // TODO (Forhad): implement claude specific token counting properly
            // this.validateTokenLimit(params);

            const result = await anthropic.messages.create(messageCreateArgs);
            const message = {
                role: result?.role || TLLMMessageRole.User,
                content: result?.content || '',
            };
            const stopReason = result?.stop_reason;

            let toolsData: ToolData[] = [];
            let useTool = false;

            if ((stopReason as 'tool_use') === 'tool_use') {
                const toolUseContentBlocks = result?.content?.filter((c) => (c.type as 'tool_use') === 'tool_use');

                if (toolUseContentBlocks?.length === 0) return;

                message.content = toolUseContentBlocks;

                toolUseContentBlocks.forEach((toolUseBlock: Anthropic.Messages.ToolUseBlock, index) => {
                    toolsData.push({
                        index,
                        id: toolUseBlock?.id,
                        type: 'function', // We call API only when the tool type is 'function' in `src/helpers/Conversation.helper.ts`. Even though Anthropic AI returns the type as 'tool_use', it should be interpreted as 'function'.
                        name: toolUseBlock?.name,
                        arguments: toolUseBlock?.input,
                        role: result?.role,
                    });
                });

                useTool = true;
            }

            const content = (result?.content?.[0] as Anthropic.TextBlock)?.text;

            return {
                data: {
                    useTool,
                    message,
                    content,
                    toolsData,
                },
            };
        } catch (error) {
            throw error;
        }
    }

    protected async imageGenRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent?: string | Agent): Promise<ImagesResponse> {
        throw new Error('Image generation request is not supported for Anthropic.');
    }

    // ! DEPRECATED METHOD
    protected async streamToolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        throw new Error('streamToolRequest() is Deprecated!');
    }

    protected async streamRequest(acRequest: AccessRequest, params: TLLMParams): Promise<EventEmitter> {
        try {
            const emitter = new EventEmitter();
            const usage_data = [];

            const apiKey = params?.credentials?.apiKey;

            // We do not provide default API key for claude, so user/team must provide their own API key
            if (!apiKey) throw new Error(API_KEY_ERROR_MESSAGE);

            const anthropic = new Anthropic({ apiKey });

            const messageCreateArgs: Anthropic.Messages.MessageStreamParams = {
                model: params?.model,
                messages: [],
                max_tokens: params?.maxTokens || LLMRegistry.getMaxCompletionTokens(params?.model, !!apiKey), // * max token is required
            };

            console.debug('Using Model', params?.model, 'Max Tokens=', params?.maxTokens);
            let messages = params?.messages || [];

            const hasSystemMessage = LLMHelper.hasSystemMessage(messages);
            if (hasSystemMessage) {
                // in Anthropic AI we need to provide system message separately
                const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(messages);

                messageCreateArgs.system = ((systemMessage as TLLMMessageBlock)?.content as string | Array<TextBlockParam>) || '';
                if (typeof messageCreateArgs.system === 'string') {
                    messageCreateArgs.system = [
                        {
                            type: 'text',
                            text: messageCreateArgs.system,
                            //cache_control: { type: 'ephemeral' }, //TODO: @Forhad check this
                        },
                    ];
                }

                messageCreateArgs.system.unshift({
                    type: 'text',
                    text: 'If you need to call a function, Do NOT inform the user that you are about to do so, and do not thank the user after you get the response. Just say something like "Give me a moment...", then when you get the response, Just continue answering the user without saying anything about the function you just called',
                });

                if (params?.cache) {
                    messageCreateArgs.system[messageCreateArgs.system.length - 1]['cache_control'] = { type: 'ephemeral' };
                }

                messages = otherMessages as Anthropic.MessageParam[];
            }

            messageCreateArgs.messages = messages;

            if (params?.toolsConfig?.tools && params?.toolsConfig?.tools.length > 0) {
                messageCreateArgs.tools = JSON.parse(JSON.stringify(params?.toolsConfig?.tools)) as Anthropic.Tool[];
                if (params?.cache) {
                    messageCreateArgs.tools[messageCreateArgs.tools.length - 1]['cache_control'] = { type: 'ephemeral' };
                }
            }
            if (params?.toolsConfig?.tool_choice) {
                messageCreateArgs.tool_choice = params?.toolsConfig?.tool_choice as unknown as Anthropic.ToolChoice;
            }

            let stream;
            if (params?.cache) {
                stream = anthropic.beta.promptCaching.messages.stream(messageCreateArgs, {
                    headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
                });
            } else {
                stream = anthropic.messages.stream(messageCreateArgs);
            }

            stream.on('streamEvent', (event: any) => {
                if (event.message?.usage) {
                    //console.log('usage', event.message?.usage);
                }
            });

            let toolsData: ToolData[] = [];

            stream.on('error', (error) => {
                //console.log('error', error);

                emitter.emit('error', error);
            });
            stream.on('text', (text: string) => {
                emitter.emit('content', text);
            });

            const finalMessage = params?.cache ? 'finalPromptCachingBetaMessage' : 'finalMessage';
            stream.on(finalMessage, (finalMessage) => {
                //console.log('finalMessage', finalMessage);
                const toolUseContentBlocks = finalMessage?.content?.filter((c) => (c.type as 'tool_use') === 'tool_use');

                if (toolUseContentBlocks?.length > 0) {
                    toolUseContentBlocks.forEach((toolUseBlock: Anthropic.Messages.ToolUseBlock, index) => {
                        toolsData.push({
                            index,
                            id: toolUseBlock?.id,
                            type: 'function', // We call API only when the tool type is 'function' in `src/helpers/Conversation.helper.ts`. Even though Anthropic AI returns the type as 'tool_use', it should be interpreted as 'function'.
                            name: toolUseBlock?.name,
                            arguments: toolUseBlock?.input,
                            role: finalMessage?.role,
                        });
                    });

                    emitter.emit('toolsData', toolsData);
                }

                if (finalMessage?.usage) {
                    const usage = finalMessage.usage;
                    usage_data.push({
                        prompt_tokens: usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens,
                        completion_tokens: usage.output_tokens,
                        total_tokens: usage.input_tokens + usage.output_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens,
                        prompt_tokens_details: { cached_tokens: usage.cache_read_input_tokens },
                        completion_tokens_details: { reasoning_tokens: 0 },
                    });
                }
                //only emit end event after processing the final message
                setTimeout(() => {
                    emitter.emit('end', toolsData, usage_data);
                }, 100);
            });

            return emitter;
        } catch (error: any) {
            throw error;
        }
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
        messageBlock: TLLMMessageBlock;
        toolsData: ToolData[];
    }): TLLMToolResultMessageBlock[] {
        const messageBlocks: TLLMToolResultMessageBlock[] = [];

        if (messageBlock) {
            const content: any[] = []; // TODO: set proper type for content
            if (Array.isArray(messageBlock.content)) {
                content.push(...messageBlock.content);
            } else {
                if (messageBlock.content) {
                    //Anthropic AI does not accept empty text blocks
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

    private getValidImageFileSources(fileSources: BinaryInput[]) {
        const validSources = [];

        for (let fileSource of fileSources) {
            if (this.validImageMimeTypes.includes(fileSource?.mimetype)) {
                validSources.push(fileSource);
            }
        }

        if (validSources?.length === 0) {
            throw new Error(`Unsupported file(s). Please make sure your file is one of the following types: ${this.validImageMimeTypes.join(', ')}`);
        }

        return validSources;
    }

    private async getImageData(
        fileSources: BinaryInput[],
        agentId: string
    ): Promise<
        {
            type: string;
            source: { type: 'base64'; data: string; media_type: string };
        }[]
    > {
        try {
            const imageData = [];

            for (let fileSource of fileSources) {
                const bufferData = await fileSource.readData(AccessCandidate.agent(agentId));
                const base64Data = bufferData.toString('base64');

                imageData.push({
                    type: 'image',
                    source: {
                        type: 'base64',
                        data: base64Data,
                        media_type: fileSource.mimetype,
                    },
                });
            }

            return imageData;
        } catch (error) {
            throw error;
        }
    }
}
