import EventEmitter from 'events';
import OpenAI from 'openai';
import { encodeChat } from 'gpt-tokenizer';

import Agent from '@sre/AgentManager/Agent.class';
import { TOOL_USE_DEFAULT_MODEL } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
import { JSON_RESPONSE_INSTRUCTION } from '@sre/constants';

import { TLLMParams, ToolData, TLLMMessageBlock, TLLMToolResultMessageBlock, TLLMMessageRole, GenerateImageConfig } from '@sre/types/LLM.types';

import { ImagesResponse, LLMChatResponse, LLMConnector } from '../LLMConnector';

const console = Logger('OpenAIConnector');

const VALID_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const MODELS_WITH_JSON_RESPONSE = ['gpt-4o-2024-08-06', 'gpt-4o-mini-2024-07-18', 'gpt-4-turbo', 'gpt-3.5-turbo'];
const o1Models = ['o1', 'o1-mini', 'o1-preview', 'o1-2024-12-17', 'o1-mini-2024-09-12', 'o1-preview-2024-09-12'];

export class OpenAIConnector extends LLMConnector {
    public name = 'LLM:OpenAI';

    private validImageMimeTypes = VALID_IMAGE_MIME_TYPES;

    protected async chatRequest(acRequest: AccessRequest, params: TLLMParams): Promise<LLMChatResponse> {
        const messages = params?.messages || [];

        //#region Handle JSON response format
        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            // We assume that the system message is first item in messages array
            if (o1Models.includes(params.model)) {
                // If the model doesn't support system prompt, then we need to add JSON response instruction to the last message
                if (messages?.[0]?.role === TLLMMessageRole.System) {
                    delete messages[0];
                    const lastIndex = messages.length - 1;
                    messages[lastIndex].content += JSON_RESPONSE_INSTRUCTION;
                } else {
                    const lastIndex = messages.length - 1;
                    messages[lastIndex].content += JSON_RESPONSE_INSTRUCTION;
                }
            } else {
                if (messages?.[0]?.role === TLLMMessageRole.System) {
                    messages[0].content += JSON_RESPONSE_INSTRUCTION;
                } else {
                    messages.unshift({ role: TLLMMessageRole.System, content: JSON_RESPONSE_INSTRUCTION });
                }
            }

            if (MODELS_WITH_JSON_RESPONSE.includes(params.model)) {
                params.responseFormat = { type: 'json_object' };
            } else {
                params.responseFormat = undefined; // We need to reset it, otherwise 'json' will be passed as a parameter to the OpenAI API
            }
        }
        //#endregion Handle JSON response format

        // Check if the team has their own API key, then use it
        const apiKey = params?.credentials?.apiKey;

        const openai = new OpenAI({
            //FIXME: use config.env instead of process.env
            apiKey: apiKey || process.env.OPENAI_API_KEY, // we provide default API key for OpenAI with limited quota
            baseURL: params.baseURL,
        });

        const chatCompletionArgs: OpenAI.ChatCompletionCreateParams & { max_completion_tokens?: number } = {
            model: params.model,
            messages,
        };

        if (params?.maxTokens !== undefined) {
            if (o1Models.includes(params.model)) {
                chatCompletionArgs.max_completion_tokens = params.maxTokens;
            } else {
                chatCompletionArgs.max_tokens = params.maxTokens;
            }
        }
        if (params?.temperature !== undefined) chatCompletionArgs.temperature = params.temperature;
        if (params?.topP !== undefined) chatCompletionArgs.top_p = params.topP;
        if (params?.frequencyPenalty !== undefined) chatCompletionArgs.frequency_penalty = params.frequencyPenalty;
        if (params?.presencePenalty !== undefined) chatCompletionArgs.presence_penalty = params.presencePenalty;
        if (params?.stopSequences?.length) chatCompletionArgs.stop = params.stopSequences;

        if (params.responseFormat) {
            chatCompletionArgs.response_format = params.responseFormat;
        }

        try {
            // Validate token limit
            const promptTokens = encodeChat(messages, 'gpt-4')?.length;

            await LLMRegistry.validateTokensLimit({
                model: params?.model,
                promptTokens,
                completionTokens: params?.maxTokens,
                hasAPIKey: !!apiKey,
            });

            const response = await openai.chat.completions.create(chatCompletionArgs);

            const content = response?.choices?.[0]?.message.content;
            const finishReason = response?.choices?.[0]?.finish_reason;

            return { content, finishReason };
        } catch (error) {
            throw error;
        }
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent?: string | Agent) {
        const messages = params?.messages || [];

        //#region Handle JSON response format
        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            // We assume that the system message is first item in messages array
            if (messages?.[0]?.role === TLLMMessageRole.System) {
                messages[0].content += JSON_RESPONSE_INSTRUCTION;
            } else {
                messages.unshift({ role: TLLMMessageRole.System, content: JSON_RESPONSE_INSTRUCTION });
            }

            if (MODELS_WITH_JSON_RESPONSE.includes(params.model)) {
                params.responseFormat = { type: 'json_object' };
            }
        }
        //#endregion Handle JSON response format

        const agentId = agent instanceof Agent ? agent.id : agent;

        const fileSources: BinaryInput[] = params?.fileSources || []; // Assign fileSource from the original parameters to avoid overwriting the original constructor
        const validSources = this.getValidImageFileSources(fileSources);
        const imageData = await this.getImageData(validSources, agentId);

        // Add user message
        const promptData = [{ type: 'text', text: prompt || '' }, ...imageData];

        messages.push({ role: 'user', content: promptData });

        try {
            // Check if the team has their own API key, then use it
            const apiKey = params?.credentials?.apiKey;

            const openai = new OpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY,
                baseURL: params.baseURL,
            });

            const chatCompletionArgs: OpenAI.ChatCompletionCreateParams = {
                model: params.model,
                messages,
            };

            if (params?.maxTokens !== undefined) chatCompletionArgs.max_tokens = params.maxTokens;
            if (params?.temperature !== undefined) chatCompletionArgs.temperature = params.temperature;
            if (params?.topP !== undefined) chatCompletionArgs.top_p = params.topP;
            if (params?.frequencyPenalty !== undefined) chatCompletionArgs.frequency_penalty = params.frequencyPenalty;
            if (params?.presencePenalty !== undefined) chatCompletionArgs.presence_penalty = params.presencePenalty;
            if (params?.responseFormat !== undefined) chatCompletionArgs.response_format = params.responseFormat;
            if (params?.stopSequences?.length) chatCompletionArgs.stop = params.stopSequences;

            // Validate token limit
            const promptTokens = await LLMHelper.countVisionPromptTokens(promptData);

            await LLMRegistry.validateTokensLimit({
                model: params?.model,
                promptTokens,
                completionTokens: params?.maxTokens,
                hasAPIKey: !!apiKey,
            });

            const response: any = await openai.chat.completions.create(chatCompletionArgs);

            const content = response?.choices?.[0]?.message.content;

            return { content, finishReason: response?.choices?.[0]?.finish_reason };
        } catch (error) {
            throw error;
        }
    }

    protected async multimodalRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent?: string | Agent): Promise<LLMChatResponse> {
        const messages = params?.messages || [];

        //#region Handle JSON response format
        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            // We assume that the system message is first item in messages array
            if (messages?.[0]?.role === TLLMMessageRole.System) {
                messages[0].content += JSON_RESPONSE_INSTRUCTION;
            } else {
                messages.unshift({ role: TLLMMessageRole.System, content: JSON_RESPONSE_INSTRUCTION });
            }

            if (MODELS_WITH_JSON_RESPONSE.includes(params.model)) {
                params.responseFormat = { type: 'json_object' };
            }
        }
        //#endregion Handle JSON response format

        const agentId = agent instanceof Agent ? agent.id : agent;

        const fileSources: BinaryInput[] = params?.fileSources || []; // Assign fileSource from the original parameters to avoid overwriting the original constructor
        const validSources = this.getValidImageFileSources(fileSources);
        const imageData = await this.getImageData(validSources, agentId);

        // Add user message
        const promptData = [{ type: 'text', text: prompt || '' }, ...imageData];

        messages.push({ role: 'user', content: promptData });

        try {
            // Check if the team has their own API key, then use it
            const apiKey = params?.credentials?.apiKey;

            const openai = new OpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY,
                baseURL: params.baseURL,
            });

            const chatCompletionArgs: OpenAI.ChatCompletionCreateParams = {
                model: params.model,
                messages,
            };

            if (params?.maxTokens !== undefined) chatCompletionArgs.max_tokens = params.maxTokens;
            if (params?.temperature !== undefined) chatCompletionArgs.temperature = params.temperature;
            if (params?.topP !== undefined) chatCompletionArgs.top_p = params.topP;
            if (params?.frequencyPenalty !== undefined) chatCompletionArgs.frequency_penalty = params.frequencyPenalty;
            if (params?.presencePenalty !== undefined) chatCompletionArgs.presence_penalty = params.presencePenalty;
            if (params?.responseFormat !== undefined) chatCompletionArgs.response_format = params.responseFormat;
            if (params?.stopSequences?.length) chatCompletionArgs.stop = params.stopSequences;

            // Validate token limit
            const promptTokens = await LLMHelper.countVisionPromptTokens(promptData);

            await LLMRegistry.validateTokensLimit({
                model: params?.model,
                promptTokens,
                completionTokens: params?.maxTokens,
                hasAPIKey: !!apiKey,
            });

            const response: any = await openai.chat.completions.create(chatCompletionArgs);

            const content = response?.choices?.[0]?.message.content;

            return { content, finishReason: response?.choices?.[0]?.finish_reason };
        } catch (error) {
            throw error;
        }
    }

    protected async imageGenRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent?: string | Agent): Promise<ImagesResponse> {
        // throw new Error('Image generation request is not supported for OpenAI.');
        try {
            const { model, size, quality, n, responseFormat, style } = params;
            const args: GenerateImageConfig & { prompt: string } = {
                prompt,
                model,
                size,
                quality,
                n: n || 1,
                response_format: responseFormat || 'url',
            };

            if (style) {
                args.style = style;
            }

            const apiKey = params?.credentials?.apiKey;

            if (!apiKey) {
                throw new Error('OpenAI API key is missing. Please provide a valid API key in the vault to proceed with Image Generation.');
            }

            const openai = new OpenAI({
                apiKey: apiKey,
                baseURL: params?.baseURL,
            });

            const response = await openai.images.generate(args);

            return response;
        } catch (error: any) {
            console.warn('Error generating image(s) with DALL·E: ', error);

            throw error;
        }
    }

    protected async toolRequest(acRequest: AccessRequest, params: TLLMParams): Promise<any> {
        const apiKey = params?.credentials?.apiKey;

        const openai = new OpenAI({
            apiKey: apiKey || process.env.OPENAI_API_KEY,
            baseURL: params.baseURL,
        });

        const messages = params?.messages || [];

        let chatCompletionArgs: OpenAI.ChatCompletionCreateParamsNonStreaming = {
            model: params.model,
            messages: messages,
        };

        if (params?.maxTokens !== undefined) chatCompletionArgs.max_tokens = params.maxTokens;

        if (params?.toolsConfig?.tools && params?.toolsConfig?.tools?.length > 0) {
            chatCompletionArgs.tools = params?.toolsConfig?.tools as OpenAI.ChatCompletionTool[];
        }

        if (params?.toolsConfig?.tool_choice) {
            chatCompletionArgs.tool_choice = params?.toolsConfig?.tool_choice as OpenAI.ChatCompletionToolChoiceOption;
        }

        try {
            const result = await openai.chat.completions.create(chatCompletionArgs);
            const message = result?.choices?.[0]?.message;
            const finishReason = result?.choices?.[0]?.finish_reason;

            let toolsData: ToolData[] = [];
            let useTool = false;

            if (finishReason === 'tool_calls') {
                toolsData =
                    message?.tool_calls?.map((tool, index) => ({
                        index,
                        id: tool?.id,
                        type: tool?.type,
                        name: tool?.function?.name,
                        arguments: tool?.function?.arguments,
                        role: 'tool',
                    })) || [];

                useTool = true;
            }

            return {
                data: { useTool, message: message, content: message?.content ?? '', toolsData },
            };
        } catch (error: any) {
            throw error;
        }
    }

    // ! DEPRECATED: will be removed
    protected async streamToolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '', baseURL = '' }
    ): Promise<any> {
        try {
            // We provide
            const openai = new OpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY,
                baseURL: baseURL,
            });

            // sanity check
            if (!Array.isArray(messages) || !messages?.length) {
                throw new Error('Invalid messages argument for chat completion.');
            }

            console.debug('model', model);
            console.debug('messages', messages);
            let args: OpenAI.ChatCompletionCreateParamsStreaming = {
                model,
                messages,
                stream: true,
            };

            if (tools && tools.length > 0) args.tools = tools;
            if (tool_choice) args.tool_choice = tool_choice;

            const stream: any = await openai.chat.completions.create(args);

            // consumed stream will not be available for further use, so we need to clone it
            const [toolCallsStream, contentStream] = stream.tee();

            let useTool = false;
            let delta: Record<string, any> = {};
            let toolsData: ToolData[] = [];
            let _stream;

            let message = {
                role: '',
                content: '',
                tool_calls: [],
            };

            for await (const part of toolCallsStream) {
                delta = part.choices[0].delta;

                message.role += delta?.role || '';
                message.content += delta?.content || '';

                //if it's not a tools call, stop processing the stream immediately in order to allow streaming the text content
                //FIXME: OpenAI API returns empty content as first message for content reply, and null content for tool reply,
                //       this doesn't seem to be a very accurate way but it's the only solution to detect tool calls early enough (without reading the whole stream)
                if (!delta?.tool_calls && delta?.content === '') {
                    _stream = contentStream;
                    break;
                }
                //_stream = toolCallsStream;
                if (delta?.tool_calls) {
                    const toolCall = delta?.tool_calls?.[0];
                    const index = toolCall?.index;

                    toolsData[index] = {
                        index,
                        role: 'tool',
                        id: (toolsData?.[index]?.id || '') + (toolCall?.id || ''),
                        type: (toolsData?.[index]?.type || '') + (toolCall?.type || ''),
                        name: (toolsData?.[index]?.name || '') + (toolCall?.function?.name || ''),
                        arguments: (toolsData?.[index]?.arguments || '') + (toolCall?.function?.arguments || ''),
                    };
                }
            }

            if (toolsData?.length > 0) {
                useTool = true;
            }

            message.tool_calls = toolsData.map((tool) => {
                return {
                    id: tool.id,
                    type: tool.type,
                    function: {
                        name: tool.name,
                        arguments: tool.arguments,
                    },
                };
            });

            //console.log('result', useTool, message, toolsData);

            return {
                data: { useTool, message, stream: _stream, toolsData },
            };
        } catch (error: any) {
            console.warn('Error on toolUseLLMRequest: ', error);
            return { error };
        }
    }

    protected async streamRequest(acRequest: AccessRequest, params: TLLMParams): Promise<EventEmitter> {
        const emitter = new EventEmitter();
        const usage_data = [];
        const apiKey = params?.credentials?.apiKey;

        const openai = new OpenAI({
            apiKey: apiKey || process.env.OPENAI_API_KEY, // we provide default API key for OpenAI with limited quota
            baseURL: params.baseURL,
        });

        //TODO: check token limits for non api key users
        console.debug('model', params.model);
        //console.debug('messages', params.messages);
        let chatCompletionArgs: OpenAI.ChatCompletionCreateParamsStreaming = {
            model: params.model,
            messages: params.messages,

            stream_options: { include_usage: true }, //add usage statis //TODO: @Forhad check this
            stream: true,
        };

        if (params?.maxTokens !== undefined) chatCompletionArgs.max_tokens = params.maxTokens;

        if (params?.toolsConfig?.tools && params?.toolsConfig?.tools?.length > 0) {
            chatCompletionArgs.tools = params?.toolsConfig?.tools as OpenAI.ChatCompletionTool[];
        }
        if (params?.toolsConfig?.tool_choice) {
            chatCompletionArgs.tool_choice = params?.toolsConfig?.tool_choice as OpenAI.ChatCompletionToolChoiceOption;
        }

        try {
            const stream: any = await openai.chat.completions.create(chatCompletionArgs);

            // Process stream asynchronously while as we need to return emitter immediately
            (async () => {
                let delta: Record<string, any> = {};

                let toolsData: any = [];

                for await (const part of stream) {
                    delta = part.choices[0]?.delta;
                    const usage = part.usage;
                    if (usage) {
                        usage_data.push(usage);
                    }
                    emitter.emit('data', delta);

                    if (!delta?.tool_calls && delta?.content) {
                        emitter.emit('content', delta?.content, delta?.role);
                    }
                    //_stream = toolCallsStream;
                    if (delta?.tool_calls) {
                        const toolCall = delta?.tool_calls?.[0];
                        const index = toolCall?.index;

                        toolsData[index] = {
                            index,
                            role: 'tool',
                            id: (toolsData?.[index]?.id || '') + (toolCall?.id || ''),
                            type: (toolsData?.[index]?.type || '') + (toolCall?.type || ''),
                            name: (toolsData?.[index]?.name || '') + (toolCall?.function?.name || ''),
                            arguments: (toolsData?.[index]?.arguments || '') + (toolCall?.function?.arguments || ''),
                        };
                    }
                }
                if (toolsData?.length > 0) {
                    emitter.emit('toolsData', toolsData);
                }

                setTimeout(() => {
                    emitter.emit('end', toolsData, usage_data);
                }, 100);
            })();
            return emitter;
        } catch (error: any) {
            throw error;
        }
    }

    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto' }) {
        let tools: OpenAI.ChatCompletionTool[] = [];

        if (type === 'function') {
            tools = toolDefinitions.map((tool) => {
                const { name, description, properties, requiredFields } = tool;

                return {
                    type: 'function',
                    function: {
                        name,
                        description,
                        parameters: {
                            type: 'object',
                            properties,
                            required: requiredFields,
                        },
                    },
                };
            });
        }

        return tools?.length > 0 ? { tools, tool_choice: toolChoice || 'auto' } : {};
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
            const transformedMessageBlock = {
                ...messageBlock,
                content: typeof messageBlock.content === 'object' ? JSON.stringify(messageBlock.content) : messageBlock.content,
            };
            if (transformedMessageBlock.tool_calls) {
                for (let toolCall of transformedMessageBlock.tool_calls) {
                    toolCall.function.arguments =
                        typeof toolCall.function.arguments === 'object' ? JSON.stringify(toolCall.function.arguments) : toolCall.function.arguments;
                }
            }
            messageBlocks.push(transformedMessageBlock);
        }

        const transformedToolsData = toolsData.map((toolData) => ({
            tool_call_id: toolData.id,
            role: TLLMMessageRole.Tool, // toolData.role as TLLMMessageRole, //should always be 'tool' for OpenAI
            name: toolData.name,
            content: typeof toolData.result === 'string' ? toolData.result : JSON.stringify(toolData.result), // Ensure content is a string
        }));

        return [...messageBlocks, ...transformedToolsData];
    }

    public getConsistentMessages(messages) {
        const _messages = LLMHelper.removeDuplicateUserMessages(messages);

        return _messages.map((message) => {
            const _message = { ...message };
            let textContent = '';

            if (message?.parts) {
                textContent = message.parts.map((textBlock) => textBlock?.text || '').join(' ');
            } else if (Array.isArray(message?.content)) {
                textContent = message.content.map((textBlock) => textBlock?.text || '').join(' ');
            } else if (message?.content) {
                textContent = message.content;
            }

            _message.content = textContent;

            return _message;
        });
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
            image_url: { url: string };
        }[]
    > {
        try {
            const imageData = [];

            for (let fileSource of fileSources) {
                const bufferData = await fileSource.readData(AccessCandidate.agent(agentId));
                const base64Data = bufferData.toString('base64');
                const url = `data:${fileSource.mimetype};base64,${base64Data}`;

                imageData.push({
                    type: 'image_url',
                    image_url: { url },
                });
            }

            return imageData;
        } catch (error) {
            throw error;
        }
    }
}
