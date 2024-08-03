import Anthropic from '@anthropic-ai/sdk';

import Agent from '@sre/AgentManager/Agent.class';
import { JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { LLMParams, ToolData, LLMMessageBlock, LLMToolResultMessageBlock } from '@sre/types/LLM.types';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { LLMChatResponse, LLMConnector } from '../LLMConnector';
import EventEmitter from 'events';

import { processWithConcurrencyLimit, isDataUrl, isUrl, getMimeTypeFromUrl, isRawBase64, parseBase64, isValidString } from '@sre/utils';

const console = Logger('AnthropicAIConnector');

type FileObject = {
    base64data: string;
    mimetype: string;
};

const VALID_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const PREFILL_TEXT_FOR_JSON_RESPONSE = '{';
const TOOL_USE_DEFAULT_MODEL = 'claude-3-5-sonnet-20240620';

export class AnthropicAIConnector extends LLMConnector {
    public name = 'LLM:AnthropicAI';

    private validImageMimeTypes = VALID_IMAGE_MIME_TYPES;

    protected async chatRequest(acRequest: AccessRequest, prompt, params): Promise<LLMChatResponse> {
        params.messages = params?.messages || [];

        // set prompt as user message if provided
        if (prompt) {
            params.messages.push({
                role: 'user',
                content: prompt,
            });
        }

        if (this.hasSystemMessage(params.messages)) {
            // in AnthropicAI we need to provide system message separately
            const { systemMessage, otherMessages } = this.separateSystemMessages(params.messages);

            params.messages = otherMessages;

            params.system = (systemMessage as LLMMessageBlock)?.content;
        }

        const responseFormat = params?.responseFormat || 'json';
        if (responseFormat === 'json') {
            params.system += JSON_RESPONSE_INSTRUCTION;
            params.messages.push({ role: 'assistant', content: PREFILL_TEXT_FOR_JSON_RESPONSE });
        }

        const apiKey = params?.apiKey;

        // We do not provide default API key for claude, so user/team must provide their own API key
        if (!apiKey) throw new Error('Please provide an API key for AnthropicAI');

        const anthropic = new Anthropic({ apiKey });

        // TODO: implement claude specific token counting to validate token limit
        // this.validateTokenLimit(params);

        try {
            const messageCreateArgs = {
                model: params.model,
                messages: params.messages,
                max_tokens: params.max_tokens,
                temperature: params.temperature,
                stop_sequences: params.stop_sequences,
                top_p: params.top_p,
                top_k: params.top_k,
            };
            const response = await anthropic.messages.create(messageCreateArgs);
            let content = (response.content?.[0] as Anthropic.TextBlock)?.text;
            const finishReason = response?.stop_reason;

            if (responseFormat === 'json') {
                content = `${PREFILL_TEXT_FOR_JSON_RESPONSE}${content}`;
            }

            return { content, finishReason };
        } catch (error) {
            console.error('Error in componentLLMRequest in AnthropicAI: ', error);

            if (error instanceof Anthropic.APIError) {
                throw error;
            } else {
                throw new Error('Internal server error! Please try again later or contact support.');
            }
        }
    }
    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent?: string | Agent) {
        params.messages = params?.messages || [];

        const fileSources = params?.fileSources || [];

        const agentId = agent instanceof Agent ? agent.id : agent;
        const agentCandidate = AccessCandidate.agent(agentId);

        const validFiles = await this.processValidFiles(fileSources, agentCandidate);

        if (validFiles?.length === 0) {
            throw new Error(`Unsupported file(s). Please make sure your file is one of the following types: ${this.validImageMimeTypes.join(', ')}`);
        }

        const fileObjectsArray = validFiles.map((file) => ({
            type: 'image',
            source: {
                type: 'base64',
                data: file.base64data,
                media_type: file.mimetype,
            },
        }));

        const content = [{ type: 'text', text: prompt }, ...fileObjectsArray];
        params.messages.push({ role: 'user', content });

        const responseFormat = params?.responseFormat || 'json';
        if (responseFormat === 'json') {
            params.system = JSON_RESPONSE_INSTRUCTION;
            params.messages.push({ role: 'assistant', content: PREFILL_TEXT_FOR_JSON_RESPONSE });
        }

        const apiKey = params?.apiKey;

        // We do not provide default API key for claude, so user/team must provide their own API key
        if (!apiKey) throw new Error('Please provide an API key for AnthropicAI');

        const anthropic = new Anthropic({ apiKey });

        // TODO (Forhad): implement claude specific token counting properly
        // this.validateTokenLimit(params);

        try {
            const messageCreateArgs = {
                model: params.model,
                messages: params.messages,
                max_tokens: params.max_tokens,
                temperature: params.temperature,
                stop_sequences: params.stop_sequences,
                top_p: params.top_p,
                top_k: params.top_k,
            };

            const response = await anthropic.messages.create(messageCreateArgs);
            let content = (response?.content?.[0] as Anthropic.TextBlock)?.text;
            const finishReason = response?.stop_reason;

            if (responseFormat === 'json') {
                content = `${PREFILL_TEXT_FOR_JSON_RESPONSE}${content}`;
            }

            return { content, finishReason };
        } catch (error) {
            console.error('Error in componentLLMRequest in Calude: ', error);

            if (error instanceof Anthropic.APIError) {
                throw error;
            } else {
                throw new Error('Internal server error! Please try again later or contact support.');
            }
        }
    }

    protected async toolRequest(
        acRequest: AccessRequest,
        { model = 'claude-3-opus-20240229', messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        try {
            // We do not provide default API key for claude, so user/team must provide their own API key
            if (!apiKey) throw new Error('Please provide an API key for AnthropicAI');

            const anthropic = new Anthropic({ apiKey });

            const messageCreateArgs: Anthropic.MessageCreateParamsNonStreaming = {
                model,
                messages: [],
                // TODO (Forhad): Need to set max dynamically based on the model
                max_tokens: 4096, // * max token is required
            };

            if (this.hasSystemMessage(messages)) {
                // in AnthropicAI we need to provide system message separately
                const { systemMessage, otherMessages } = this.separateSystemMessages(messages);

                messageCreateArgs.system = ((systemMessage as LLMMessageBlock)?.content as string) || '';

                messageCreateArgs.messages = otherMessages as Anthropic.MessageParam[];
            }

            if (tools && tools.length > 0) messageCreateArgs.tools = tools;

            // TODO (Forhad): implement claude specific token counting properly
            // this.validateTokenLimit(params);

            const result = await anthropic.messages.create(messageCreateArgs);
            const message = {
                role: result?.role || 'user',
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
                        role: 'user',
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

    // ! DEPRECATED METHOD
    protected async streamToolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        throw new Error('streamToolRequest() is Deprecated!');
    }

    protected async streamRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<EventEmitter> {
        try {
            const emitter = new EventEmitter();

            // We do not provide default API key for claude, so user/team must provide their own API key
            if (!apiKey) throw new Error('Please provide an API key for AnthropicAI');

            const anthropic = new Anthropic({ apiKey });

            const messageCreateArgs: Anthropic.Messages.MessageStreamParams = {
                model,
                messages: [],
                // TODO (Forhad): Need to set max dynamically based on the model
                max_tokens: 4096, // * max token is required
            };

            if (this.hasSystemMessage(messages)) {
                // in Anthropic AI we need to provide system message separately
                const { systemMessage, otherMessages } = this.separateSystemMessages(messages);

                messageCreateArgs.system = ((systemMessage as LLMMessageBlock)?.content as string) || '';

                messageCreateArgs.messages = this.checkMessagesConsistency(otherMessages as Anthropic.MessageParam[]);
            } else {
                messageCreateArgs.messages = this.checkMessagesConsistency(messages);
            }

            if (tools && tools.length > 0) messageCreateArgs.tools = tools;

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
                            role: 'user',
                        });
                    });

                    emitter.emit('toolsData', toolsData);
                }

                //only emit enf event after processing the final message
                setTimeout(() => {
                    emitter.emit('end', toolsData);
                }, 100);
            });

            return emitter;
        } catch (error: any) {
            throw error;
        }
    }

    private checkMessagesConsistency(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
        //handle models specific messages content consistency
        //   identified case that need to be handled

        if (messages.length <= 0) return messages;

        //[FIXED] - `tool_result` block(s) provided when previous message does not contain any `tool_use` blocks" (handler)
        if (messages[0].role === 'user' && Array.isArray(messages[0].content)) {
            const hasToolResult = messages[0].content.find((content) => content.type === 'tool_result');

            //we found a tool result in the first message, so we need to remove the user message
            if (hasToolResult) {
                messages.shift();
            }
        }

        //   - Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"messages: first message must use the \"user\" role"}}
        if (messages[0].role !== 'user') {
            messages.unshift({ role: 'user', content: 'continue' }); //add an empty user message to keep the consistency
        }

        return messages;
    }
    public async extractVisionLLMParams(config: any) {
        const params: LLMParams = await super.extractVisionLLMParams(config);

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

    public prepareInputMessageBlocks({
        messageBlock,
        toolsData,
    }: {
        messageBlock: LLMMessageBlock;
        toolsData: ToolData[];
    }): LLMToolResultMessageBlock[] {
        const messageBlocks: LLMToolResultMessageBlock[] = [];

        if (messageBlock) {
            const content = [];
            if (typeof messageBlock.content === 'object') {
                content.push(messageBlock.content);
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

            // const transformedMessageBlock = {
            //     role: messageBlock.role,
            //     content: typeof messageBlock.content === 'object' ?  messageBlock.content : ,
            //     //...messageBlock,
            //     //content: typeof messageBlock.content === 'object' ? JSON.stringify(messageBlock.content) : messageBlock.content,
            // };
            messageBlocks.push({
                role: messageBlock.role,
                content: content,
            });
        }

        const transformedToolsData = toolsData.map((toolData) => ({
            role: 'user',
            content: [
                {
                    type: 'tool_result',
                    tool_use_id: toolData.id,
                    content: toolData.result,
                },
            ],
        }));

        return [...messageBlocks, ...transformedToolsData];
    }

    private async processValidFiles(fileSources: string[] | Record<string, any>[], candidate: IAccessCandidate): Promise<FileObject[]> {
        const fileProcessingTasks = fileSources.map((fileSource) => async (): Promise<FileObject> => {
            if (!fileSource) return null;

            if (typeof fileSource === 'object' && fileSource.url && fileSource.mimetype) {
                return await this.processObjectFileSource(fileSource, candidate);
            }

            if (isValidString(fileSource as string)) {
                return await this.processStringFileSource(fileSource as string, candidate);
            }

            return null;
        });

        const validFiles = await processWithConcurrencyLimit(fileProcessingTasks);

        return validFiles as FileObject[];
    }

    private async processObjectFileSource(fileSource: Record<string, string>, candidate: IAccessCandidate): Promise<FileObject | null> {
        const { mimetype } = fileSource;

        if (!this.validImageMimeTypes.includes(mimetype)) return null;

        const binaryInput = new BinaryInput(fileSource);
        const base64data = (await binaryInput.getBuffer()).toString('base64');

        return { base64data, mimetype };
    }

    private async processStringFileSource(fileSource: string, candidate: IAccessCandidate): Promise<FileObject | null> {
        let mimetype = '';

        if (isUrl(fileSource)) {
            mimetype = await getMimeTypeFromUrl(fileSource);
        } else if (isDataUrl(fileSource) || isRawBase64(fileSource)) {
            const parsedBase64 = await parseBase64(fileSource);
            mimetype = parsedBase64.mimetype;
        }

        if (!this.validImageMimeTypes.includes(mimetype)) return null;

        const binaryInput = new BinaryInput(fileSource);
        const base64data = (await binaryInput.getBuffer()).toString('base64');

        return { base64data, mimetype };
    }
}
