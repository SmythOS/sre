import EventEmitter from 'events';
import Anthropic from '@anthropic-ai/sdk';

import Agent from '@sre/AgentManager/Agent.class';
import { JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { TLLMParams, ToolData, TLLMMessageBlock, TLLMToolResultMessageBlock, TLLMMessageRole } from '@sre/types/LLM.types';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { processWithConcurrencyLimit, isDataUrl, isUrl, getMimeTypeFromUrl, isRawBase64, parseBase64, isValidString } from '@sre/utils';

import { ImagesResponse, LLMChatResponse, LLMConnector } from '../LLMConnector';

const console = Logger('AnthropicAIConnector');

const VALID_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const PREFILL_TEXT_FOR_JSON_RESPONSE = '{';
const TOOL_USE_DEFAULT_MODEL = 'claude-3-5-sonnet-20240620';

export class AnthropicAIConnector extends LLMConnector {
    public name = 'LLM:AnthropicAI';

    private validImageMimeTypes = VALID_IMAGE_MIME_TYPES;

    protected async chatRequest(acRequest: AccessRequest, prompt, params): Promise<LLMChatResponse> {
        const _params = { ...params }; // Avoid mutation of the original params object

        let messages = _params?.messages || [];

        // set prompt as user message if provided
        if (prompt) {
            messages.push({
                role: TLLMMessageRole.User,
                content: prompt,
            });
        }

        const hasSystemMessage = this.llmHelper.MessageProcessor().hasSystemMessage(messages);
        if (hasSystemMessage) {
            // in AnthropicAI we need to provide system message separately
            const { systemMessage, otherMessages } = this.llmHelper.MessageProcessor().separateSystemMessages(messages);

            messages = otherMessages;

            _params.system = (systemMessage as TLLMMessageBlock)?.content;
        }

        // We need to get consistent messages after separating system messages to make sure the first message is a user message
        messages = Array.isArray(messages) ? this.getConsistentMessages(messages) : [];

        const responseFormat = _params?.responseFormat || 'json';
        if (responseFormat === 'json') {
            _params.system += JSON_RESPONSE_INSTRUCTION;
            messages.push({ role: TLLMMessageRole.Assistant, content: PREFILL_TEXT_FOR_JSON_RESPONSE });
        }

        const apiKey = _params?.apiKey;

        // We do not provide default API key for claude, so user/team must provide their own API key
        if (!apiKey) throw new Error('Please provide an API key for AnthropicAI');

        const anthropic = new Anthropic({ apiKey });

        // TODO: implement claude specific token counting to validate token limit
        // this.validateTokenLimit(_params);

        const messageCreateArgs: Anthropic.MessageCreateParamsNonStreaming = {
            model: _params.model,
            messages,
            max_tokens: _params?.max_tokens || (await this.llmHelper.TokenManager().getAllowedCompletionTokens(_params?.model, !!apiKey)),
        };

        if (_params?.temperature) messageCreateArgs.temperature = _params.temperature;
        if (_params?.stop_sequences) messageCreateArgs.stop_sequences = _params.stop_sequences;
        if (_params?.top_p) messageCreateArgs.top_p = _params.top_p;
        if (_params?.top_k) messageCreateArgs.top_k = _params.top_k;

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

    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent?: string | Agent) {
        const _params = { ...params }; // Avoid mutation of the original params object

        const messages = Array.isArray(_params?.messages) ? this.getConsistentMessages(_params.messages) : [];

        const agentId = agent instanceof Agent ? agent.id : agent;

        const fileSources: BinaryInput[] = _params?.fileSources || [];
        const validSources = this.getValidImageFileSources(fileSources);
        const imageData = await this.getImageData(validSources, agentId);

        const content = [{ type: 'text', text: prompt }, ...imageData];
        messages.push({ role: TLLMMessageRole.User, content });

        const apiKey = _params?.apiKey;

        // We do not provide default API key for claude, so user/team must provide their own API key
        if (!apiKey) throw new Error('Please provide an API key for AnthropicAI');

        const anthropic = new Anthropic({ apiKey });

        // TODO (Forhad): implement claude specific token counting properly
        // this.validateTokenLimit(params);

        const messageCreateArgs: Anthropic.MessageCreateParamsNonStreaming = {
            model: _params.model,
            messages,
            max_tokens: _params?.max_tokens || (await this.llmHelper.TokenManager().getAllowedCompletionTokens(_params?.model, !!apiKey)),
        };

        try {
            const response = await anthropic.messages.create(messageCreateArgs);
            let content = (response?.content?.[0] as Anthropic.TextBlock)?.text;
            const finishReason = response?.stop_reason;

            return { content, finishReason };
        } catch (error) {
            throw error;
        }
    }

    protected async multimodalRequest(acRequest: AccessRequest, prompt, params: any, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Multimodal request is not supported for OpenAI.');
    }

    protected async toolRequest(acRequest: AccessRequest, params): Promise<any> {
        const _params = { ...params };

        try {
            // We do not provide default API key for claude, so user/team must provide their own API key
            if (!_params?.apiKey) throw new Error('Please provide an API key for AnthropicAI');

            const anthropic = new Anthropic({ apiKey: _params?.apiKey });

            const messageCreateArgs: Anthropic.MessageCreateParamsNonStreaming = {
                model: _params?.model,
                messages: [],
                max_tokens:
                    _params?.max_tokens || (await this.llmHelper.TokenManager().getAllowedCompletionTokens(_params?.model, !!_params?.apiKey)), // * max token is required
            };

            let messages = _params?.messages || [];

            const hasSystemMessage = this.llmHelper.MessageProcessor().hasSystemMessage(messages);
            if (hasSystemMessage) {
                // in AnthropicAI we need to provide system message separately
                const { systemMessage, otherMessages } = this.llmHelper.MessageProcessor().separateSystemMessages(messages);

                messageCreateArgs.system = ((systemMessage as TLLMMessageBlock)?.content as string) || '';

                messages = otherMessages as Anthropic.MessageParam[];
            }

            // We need to get consistent messages after separating system messages to make sure the first message is a user message
            messages = Array.isArray(messages) ? this.getConsistentMessages(messages) : [];

            messageCreateArgs.messages = messages;

            if (_params?.toolsConfig?.tools && _params?.toolsConfig?.tools.length > 0) messageCreateArgs.tools = _params?.toolsConfig?.tools;

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
                        role: TLLMMessageRole.User,
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

    protected async imageGenRequest(acRequest: AccessRequest, prompt, params: any, agent?: string | Agent): Promise<ImagesResponse> {
        throw new Error('Image generation request is not supported for AnthropicAI.');
    }

    // ! DEPRECATED METHOD
    protected async streamToolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        throw new Error('streamToolRequest() is Deprecated!');
    }

    protected async streamRequest(acRequest: AccessRequest, params): Promise<EventEmitter> {
        const _params = { ...params };
        try {
            const emitter = new EventEmitter();

            // We do not provide default API key for claude, so user/team must provide their own API key
            if (!_params?.apiKey) throw new Error('Please provide an API key for AnthropicAI');

            const anthropic = new Anthropic({ apiKey: _params?.apiKey });

            const messageCreateArgs: Anthropic.Messages.MessageStreamParams = {
                model: _params?.model,
                messages: [],
                max_tokens:
                    _params?.max_tokens || (await this.llmHelper.TokenManager().getAllowedCompletionTokens(_params?.model, !!_params?.apiKey)), // * max token is required
            };

            let messages = _params?.messages || [];

            const hasSystemMessage = this.llmHelper.MessageProcessor().hasSystemMessage(messages);
            if (hasSystemMessage) {
                // in Anthropic AI we need to provide system message separately
                const { systemMessage, otherMessages } = this.llmHelper.MessageProcessor().separateSystemMessages(messages);

                messageCreateArgs.system = ((systemMessage as TLLMMessageBlock)?.content as string) || '';

                messages = otherMessages as Anthropic.MessageParam[];
            }

            // We need to get consistent messages after separating system messages to make sure the first message is a user message
            messages = Array.isArray(messages) ? this.getConsistentMessages(messages) : [];

            messageCreateArgs.messages = messages;

            if (_params?.toolsConfig?.tools && _params?.toolsConfig?.tools.length > 0) messageCreateArgs.tools = _params?.toolsConfig?.tools;

            const stream = anthropic.messages.stream(messageCreateArgs);

            stream.on('error', (error) => {
                emitter.emit('error', error);
            });

            let toolsData: ToolData[] = [];

            stream.on('text', (text: string) => {
                emitter.emit('content', text);
            });

            stream.on('finalMessage', (finalMessage) => {
                const toolUseContentBlocks = finalMessage?.content?.filter((c) => (c.type as 'tool_use') === 'tool_use');

                if (toolUseContentBlocks?.length > 0) {
                    toolUseContentBlocks.forEach((toolUseBlock: Anthropic.Messages.ToolUseBlock, index) => {
                        toolsData.push({
                            index,
                            id: toolUseBlock?.id,
                            type: 'function', // We call API only when the tool type is 'function' in `src/helpers/Conversation.helper.ts`. Even though Anthropic AI returns the type as 'tool_use', it should be interpreted as 'function'.
                            name: toolUseBlock?.name,
                            arguments: toolUseBlock?.input,
                            role: TLLMMessageRole.User,
                        });
                    });

                    emitter.emit('toolsData', toolsData);
                }

                //only emit end event after processing the final message
                setTimeout(() => {
                    emitter.emit('end', toolsData);
                }, 100);
            });

            return emitter;
        } catch (error: any) {
            throw error;
        }
    }

    public async extractVisionLLMParams(config: any) {
        const params: TLLMParams = await super.extractVisionLLMParams(config);

        return params;
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
            const content = [];
            if (Array.isArray(messageBlock.content)) {
                content.push(...messageBlock.content);
            } else {
                content.push({ type: 'text', text: messageBlock.content });
            }
            if (messageBlock.tool_calls) {
                const calls = messageBlock.tool_calls.map((toolCall: any) => ({
                    type: 'tool_use',
                    id: toolCall.id,
                    name: toolCall?.function?.name,
                    input: toolCall?.function?.arguments,
                }));

                content.push(...calls);
            }

            messageBlocks.push({
                role: messageBlock.role,
                content: content,
            });
        }

        const transformedToolsData = toolsData.map(
            (toolData): TLLMToolResultMessageBlock => ({
                role: TLLMMessageRole.User,
                content: [
                    {
                        type: 'tool_result',
                        tool_use_id: toolData.id,
                        content: toolData.result,
                    },
                ],
            })
        );

        return [...messageBlocks, ...transformedToolsData];
    }

    private getConsistentMessages(messages) {
        let _messages = [...messages];

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
                        content = message.content;
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

            message.content = content;

            return message;
        });

        //[FIXED] - `tool_result` block(s) provided when previous message does not contain any `tool_use` blocks" (handler)
        if (messages[0].role === TLLMMessageRole.User && Array.isArray(messages[0].content)) {
            const hasToolResult = messages[0].content.find((content) => 'type' in content && content.type === 'tool_result');

            //we found a tool result in the first message, so we need to remove the user message
            if (hasToolResult) {
                messages.shift();
            }
        }

        //   - Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"messages: first message must use the \"user\" role"}}
        if (messages[0].role !== TLLMMessageRole.User) {
            messages.unshift({ role: TLLMMessageRole.User, content: 'continue' }); //add an empty user message to keep the consistency
        }

        return messages;
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
