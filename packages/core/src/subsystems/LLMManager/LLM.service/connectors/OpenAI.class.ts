import EventEmitter from 'events';
import OpenAI from 'openai';
import { encodeChat } from 'gpt-tokenizer';

import Agent from '@sre/AgentManager/Agent.class';
import { TOOL_USE_DEFAULT_MODEL } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { LLMParams, ToolData, LLMMessageBlock, LLMToolResultMessageBlock } from '@sre/types/LLM.types';

import { LLMChatResponse, LLMConnector, LLMStream } from '../LLMConnector';

const console = Logger('OpenAIConnector');

export class OpenAIConnector extends LLMConnector {
    public name = 'LLM:OpenAI';

    protected async chatRequest(acRequest: AccessRequest, prompt, params): Promise<LLMChatResponse> {
        const _params = { ...params }; // Avoid mutation of the original _params object

        // Open to take system message with params, if no system message found then force to get JSON response in default
        if (!_params.messages) _params.messages = [];

        //FIXME: We probably need to separate the json system from default chatRequest
        if (_params.messages[0]?.role !== 'system') {
            _params.messages.unshift({
                role: 'system',
                content: 'All responses should be in valid json format. The returned json should not be formatted with any newlines or indentations.',
            });

            if (_params.model.startsWith('gpt-4-turbo') || _params.model.startsWith('gpt-3.5-turbo')) {
                _params.response_format = { type: 'json_object' };
            }
        }

        if (prompt && _params.messages.length === 1) {
            _params.messages.push({ role: 'user', content: prompt });
        }

        // Check if the team has their own API key, then use it
        const apiKey = _params?.apiKey;

        const openai = new OpenAI({
            //FIXME: use config.env instead of process.env
            apiKey: apiKey || process.env.OPENAI_API_KEY,
        });

        // Check token limit
        const promptTokens = encodeChat(_params.messages, 'gpt-4')?.length;

        const tokensLimit = this.checkTokensLimit({
            model: _params.model,
            promptTokens,
            completionTokens: _params?.max_tokens,
            hasTeamAPIKey: !!apiKey,
        });

        if (tokensLimit.isExceeded) throw new Error(tokensLimit.error);

        const chatCompletionArgs: OpenAI.ChatCompletionCreateParams = {
            model: _params.model,
            messages: _params.messages,
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
            console.log('Error in chatRequest in OpenAI: ', error);
            throw error;
        }
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent?: string | Agent) {
        //if (!params.model) params.model = 'gpt-4-vision-preview';

        // Open to take system message with params, if no system message found then force to get JSON response in default
        if (!params.messages || params.messages?.length === 0) params.messages = [];
        if (params.messages?.role !== 'system') {
            params.messages.unshift({
                role: 'system',
                content:
                    'All responses should be in valid json format. The returned json should not be formatted with any newlines, indentations. For example: {"<guess key from response>":"<response>"}',
            });
        }

        const sources: BinaryInput[] = params?.sources || [];
        delete params?.sources; // Remove images from params

        //const imageData = await prepareImageData(sources, 'OpenAI', agent);

        const agentId = agent instanceof Agent ? agent.id : agent;
        const imageData = [];
        for (let source of sources) {
            const bufferData = await source.readData(AccessCandidate.agent(agentId));
            const base64Data = bufferData.toString('base64');
            const url = `data:${source.mimetype};base64,${base64Data}`;
            imageData.push({
                type: 'image_url',
                image_url: {
                    url,
                },
            });
        }

        // Add user message
        const promptData = [{ type: 'text', text: prompt }, ...imageData];
        params.messages.push({ role: 'user', content: promptData });

        try {
            // Check if the team has their own API key, then use it
            const apiKey = params?.apiKey;
            delete params.apiKey; // Remove apiKey from params

            const openai = new OpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY,
            });

            // Check token limit
            const promptTokens = await this.countVisionPromptTokens(promptData);

            const tokenLimit = this.checkTokensLimit({
                model: params.model,
                promptTokens,
                completionTokens: params?.max_tokens,
                hasTeamAPIKey: !!apiKey,
            });

            if (tokenLimit.isExceeded) throw new Error(tokenLimit.error);

            const response: any = await openai.chat.completions.create({ ...params });

            const content = response?.choices?.[0]?.message.content;

            return { content, finishReason: response?.choices?.[0]?.finish_reason };
        } catch (error) {
            console.log('Error in visionLLMRequest: ', error);

            throw error;
        }
    }

    protected async toolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, max_tokens, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        try {
            // We provide
            const openai = new OpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY,
            });

            // sanity check
            if (!Array.isArray(messages) || !messages?.length) {
                return { error: new Error('Invalid messages argument for chat completion.') };
            }

            let args: OpenAI.ChatCompletionCreateParamsNonStreaming = {
                model,
                messages,
                max_tokens,
            };

            if (tools && tools.length > 0) args.tools = tools;
            if (tool_choice) args.tool_choice = tool_choice;

            const result = await openai.chat.completions.create(args);
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
            console.log('Error on toolUseLLMRequest: ', error);
            return { error };
        }
    }

    protected async streamToolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        try {
            // We provide
            const openai = new OpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY,
            });

            // sanity check
            if (!Array.isArray(messages) || !messages?.length) {
                return { error: new Error('Invalid messages argument for chat completion.') };
            }

            console.log('model', model);
            console.log('messages', messages);
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
            console.log('Error on toolUseLLMRequest: ', error);
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

    protected async streamRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, max_tokens, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<EventEmitter> {
        const emitter = new EventEmitter();
        const openai = new OpenAI({
            apiKey: apiKey || process.env.OPENAI_API_KEY,
        });

        //TODO: check token limits for non api key users
        console.log('model', model);
        console.log('messages', messages);
        let args: OpenAI.ChatCompletionCreateParamsStreaming = {
            model,
            messages,
            max_tokens,
            stream: true,
        };

        if (tools && tools.length > 0) args.tools = tools;
        if (tool_choice) args.tool_choice = tool_choice;
        const stream: any = await openai.chat.completions.create(args);

        // Process stream asynchronously while as we need to return emitter immediately
        (async () => {
            let delta: Record<string, any> = {};

            let toolsData: any = [];

            for await (const part of stream) {
                delta = part.choices[0].delta;
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
                emitter.emit('end', toolsData);
            }, 100);
        })();
        return emitter;
    }

    public async extractVisionLLMParams(config: any) {
        const params: LLMParams = await super.extractVisionLLMParams(config);

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

    public prepareInputMessageBlocks({
        messageBlock,
        toolsData,
    }: {
        messageBlock: LLMMessageBlock;
        toolsData: ToolData[];
    }): LLMToolResultMessageBlock[] {
        const messageBlocks: LLMToolResultMessageBlock[] = [];

        if (messageBlock) {
            const transformedMessageBlock = {
                ...messageBlock,
                content: typeof messageBlock.content === 'object' ? JSON.stringify(messageBlock.content) : messageBlock.content,
            };
            messageBlocks.push(transformedMessageBlock);
        }

        const transformedToolsData = toolsData.map((toolData) => ({
            tool_call_id: toolData.id,
            role: toolData.role,
            name: toolData.name,
            content: typeof toolData.result === 'string' ? toolData.result : JSON.stringify(toolData.result), // Ensure content is a string
        }));

        return [...messageBlocks, ...transformedToolsData];
    }
}
