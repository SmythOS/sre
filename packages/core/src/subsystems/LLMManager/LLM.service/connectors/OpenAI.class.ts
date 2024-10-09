import EventEmitter from 'events';
import OpenAI from 'openai';
import { encodeChat } from 'gpt-tokenizer';

import Agent from '@sre/AgentManager/Agent.class';
import { TOOL_USE_DEFAULT_MODEL } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';

import { TLLMParams, ToolData, TLLMMessageBlock, TLLMToolResultMessageBlock, TLLMMessageRole, GenerateImageConfig } from '@sre/types/LLM.types';

import { ImagesResponse, LLMChatResponse, LLMConnector } from '../LLMConnector';

const console = Logger('OpenAIConnector');

const VALID_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const MODELS_WITH_JSON_RESPONSE = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];

export class OpenAIConnector extends LLMConnector {
    public name = 'LLM:OpenAI';

    private validImageMimeTypes = VALID_IMAGE_MIME_TYPES;

    protected async chatRequest(acRequest: AccessRequest, prompt, params): Promise<LLMChatResponse> {
        const _params = { ...params }; // Avoid mutation of the original params object

        const messages = Array.isArray(_params.messages) ? this.getConsistentMessages(_params.messages) : [];

        //FIXME: We probably need to separate the json system from default chatRequest
        if (messages[0]?.role !== 'system') {
            messages.unshift({
                role: TLLMMessageRole.System,
                content: 'All responses should be in valid json format. The returned json should not be formatted with any newlines or indentations.',
            });

            if (MODELS_WITH_JSON_RESPONSE.includes(_params.model)) {
                _params.response_format = { type: 'json_object' };
            }
        }

        if (prompt && messages.length === 1) {
            messages.push({ role: TLLMMessageRole.User, content: prompt });
        }

        // Check if the team has their own API key, then use it
        const apiKey = _params?.apiKey;

        const openai = new OpenAI({
            //FIXME: use config.env instead of process.env
            apiKey: apiKey || process.env.OPENAI_API_KEY,
            baseURL: _params.baseURL,
        });

        // Validate token limit
        const promptTokens = encodeChat(messages, 'gpt-4')?.length;

        await this.llmHelper.TokenManager().validateTokensLimit({
            modelName: _params?.model,
            promptTokens,
            completionTokens: _params?.max_tokens,
            hasAPIKey: !!apiKey,
        });

        const chatCompletionArgs: OpenAI.ChatCompletionCreateParams = {
            model: _params.model,
            messages,
        };

        if (_params?.max_tokens) chatCompletionArgs.max_tokens = _params.max_tokens;
        if (_params?.temperature) chatCompletionArgs.temperature = _params.temperature;
        if (_params?.stop) chatCompletionArgs.stop = _params.stop;
        if (_params?.top_p) chatCompletionArgs.top_p = _params.top_p;
        if (_params?.frequency_penalty) chatCompletionArgs.frequency_penalty = _params.frequency_penalty;
        if (_params?.presence_penalty) chatCompletionArgs.presence_penalty = _params.presence_penalty;
        if (_params?.response_format) chatCompletionArgs.response_format = _params.response_format;

        try {
            const response = await openai.chat.completions.create(chatCompletionArgs);

            const content = response?.choices?.[0]?.message.content;
            const finishReason = response?.choices?.[0]?.finish_reason;

            return { content, finishReason };
        } catch (error) {
            throw error;
        }
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent?: string | Agent) {
        const _params = { ...params }; // Avoid mutation of the original params object

        const messages = Array.isArray(_params.messages) ? this.getConsistentMessages(_params.messages) : [];

        if (messages[0]?.role !== 'system') {
            messages.unshift({
                role: 'system',
                content:
                    'All responses should be in valid json format. The returned json should not be formatted with any newlines, indentations. For example: {"<guess key from response>":"<response>"}',
            });

            if (MODELS_WITH_JSON_RESPONSE.includes(_params.model)) {
                _params.response_format = { type: 'json_object' };
            }
        }

        const agentId = agent instanceof Agent ? agent.id : agent;

        const fileSources: BinaryInput[] = _params?.fileSources || [];
        const validSources = this.getValidImageFileSources(fileSources);
        const imageData = await this.getImageData(validSources, agentId);

        // Add user message
        const promptData = [{ type: 'text', text: prompt }, ...imageData];

        if (prompt && messages.length === 1) {
            messages.push({ role: 'user', content: promptData });
        }

        try {
            // Check if the team has their own API key, then use it
            const apiKey = _params?.apiKey;

            const openai = new OpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY,
                baseURL: _params.baseURL,
            });

            // Validate token limit
            const promptTokens = await this.llmHelper.FileProcessor().countVisionPromptTokens(promptData);

            await this.llmHelper.TokenManager().validateTokensLimit({
                modelName: _params?.model,
                promptTokens,
                completionTokens: _params?.max_tokens,
                hasAPIKey: !!apiKey,
            });

            const chatCompletionArgs: OpenAI.ChatCompletionCreateParams = {
                model: _params.model,
                messages,
            };

            if (_params?.max_tokens) {
                chatCompletionArgs.max_tokens = _params.max_tokens;
            }

            const response: any = await openai.chat.completions.create(chatCompletionArgs);

            const content = response?.choices?.[0]?.message.content;

            return { content, finishReason: response?.choices?.[0]?.finish_reason };
        } catch (error) {
            throw error;
        }
    }

    protected async multimodalRequest(acRequest: AccessRequest, prompt, params: any, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Multimodal request is not supported for OpenAI.');
    }

    protected async imageGenRequest(acRequest: AccessRequest, prompt, params: any, agent?: string | Agent): Promise<ImagesResponse> {
        // throw new Error('Image generation request is not supported for OpenAI.');
        try {
            const { model, size, quality, n, response_format, style } = params;
            const args: GenerateImageConfig & { prompt: string } = {
                prompt,
                model,
                size,
                quality,
                n,
                response_format,
            };

            if (style) {
                args.style = style;
            }

            const apiKey = params?.apiKey;

            const openai = new OpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY,
                baseURL: params?.baseURL,
            });

            const response = await openai.images.generate(args);

            return response;
        } catch (error: any) {
            console.warn('Error generating image(s) with DALL·E: ', error);

            throw error;
        }
    }

    protected async toolRequest(acRequest: AccessRequest, params): Promise<any> {
        const _params = { ...params };

        // We provide
        const openai = new OpenAI({
            apiKey: _params.apiKey || process.env.OPENAI_API_KEY,
            baseURL: _params.baseURL,
        });

        const messages = this.getConsistentMessages(_params.messages);

        let chatCompletionArgs: OpenAI.ChatCompletionCreateParamsNonStreaming = {
            model: _params.model,
            messages: messages,
            max_tokens: _params.max_tokens,
        };

        if (_params?.toolsConfig?.tools && _params?.toolsConfig?.tools?.length > 0) chatCompletionArgs.tools = _params?.toolsConfig?.tools;
        if (_params?.toolsConfig?.tool_choice) chatCompletionArgs.tool_choice = _params?.toolsConfig?.tool_choice;

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

    // protected async stremRequest(
    //     acRequest: AccessRequest,
    //     { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    // ): Promise<Readable> {
    //     const stream = new LLMStream();

    //     const openai = new OpenAI({
    //         apiKey: apiKey || process.env.OPENAI_API_KEY,
    //     });

    //     console.log('model', model);
    //     console.log('messages', messages);

    //     let args: OpenAI.ChatCompletionCreateParamsStreaming = {
    //         model,
    //         messages,
    //         stream: true,
    //     };

    //     if (tools && tools.length > 0) args.tools = tools;
    //     if (tool_choice) args.tool_choice = tool_choice;

    //     const openaiStream: any = await openai.chat.completions.create(args);

    //     let toolsData: any = [];
    //     stream.enqueueData({ start: true });
    //     (async () => {
    //         for await (const part of openaiStream) {
    //             const delta = part.choices[0].delta;
    //             //stream.enqueueData(delta);

    //             if (!delta?.tool_calls && delta?.content) {
    //                 stream.enqueueData({ content: delta.content, role: delta.role });
    //             }

    //             if (delta?.tool_calls) {
    //                 const toolCall = delta.tool_calls[0];
    //                 const index = toolCall.index;

    //                 toolsData[index] = {
    //                     index,
    //                     role: 'tool',
    //                     id: (toolsData[index]?.id || '') + (toolCall?.id || ''),
    //                     type: (toolsData[index]?.type || '') + (toolCall?.type || ''),
    //                     name: (toolsData[index]?.name || '') + (toolCall?.function?.name || ''),
    //                     arguments: (toolsData[index]?.arguments || '') + (toolCall?.function?.arguments || ''),
    //                 };
    //             }
    //         }

    //         stream.enqueueData({ toolsData });
    //         //stream.endStream();
    //     })();

    //     return stream;
    // }

    protected async streamRequest(acRequest: AccessRequest, params): Promise<EventEmitter> {
        const _params = { ...params };

        const emitter = new EventEmitter();
        const usage_data = [];
        const openai = new OpenAI({
            apiKey: _params.apiKey || process.env.OPENAI_API_KEY,
            baseURL: _params.baseURL,
        });

        //TODO: check token limits for non api key users
        console.debug('model', _params.model);
        //console.debug('messages', _params.messages);
        let chatCompletionArgs: OpenAI.ChatCompletionCreateParamsStreaming = {
            model: _params.model,
            messages,
            max_tokens: _params.max_tokens,
            stream_options: { include_usage: true }, //add usage statis
            stream: true,
        };

        if (_params?.toolsConfig?.tools && _params?.toolsConfig?.tools?.length > 0) chatCompletionArgs.tools = _params?.toolsConfig?.tools;
        if (_params?.toolsConfig?.tool_choice) chatCompletionArgs.tool_choice = _params?.toolsConfig?.tool_choice;

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

    public async extractVisionLLMParams(config: any) {
        const params: TLLMParams = await super.extractVisionLLMParams(config);

        return params;
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

    private getConsistentMessages(messages) {
        return messages.map((message) => {
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
