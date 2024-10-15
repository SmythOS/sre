import EventEmitter from 'events';
import OpenAI from 'openai';
import { encodeChat } from 'gpt-tokenizer';

import Agent from '@sre/AgentManager/Agent.class';
import { JSON_RESPONSE_INSTRUCTION, TOOL_USE_DEFAULT_MODEL } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { TLLMParams, TLLMMessageBlock, ToolData } from '@sre/types/LLM.types';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';

import { ImagesResponse, LLMChatResponse, LLMConnector } from '../LLMConnector';

const console = Logger('TogetherAIConnector');

const TOGETHER_AI_API_URL = 'https://api.together.xyz/v1';

export class TogetherAIConnector extends LLMConnector {
    public name = 'LLM:TogetherAI';

    protected async chatRequest(acRequest: AccessRequest, prompt, params: TLLMParams): Promise<LLMChatResponse> {
        const _params = { ...params }; // Avoid mutation of the original params object

        // Open to take system message with params, if no system message found then force to get JSON response in default
        if (!_params.messages) _params.messages = [];

        const messages = _params?.messages || [];

        //#region Handle JSON response format
        const responseFormat = _params?.responseFormat || '';
        if (responseFormat === 'json') {
            if (messages?.[0]?.role === 'system') {
                messages[0].content += JSON_RESPONSE_INSTRUCTION;
            } else {
                messages.unshift({ role: 'system', content: JSON_RESPONSE_INSTRUCTION });
            }
        }
        //#endregion Handle JSON response format

        if (prompt) {
            messages.push({ role: 'user', content: prompt });
        }

        // Check if the team has their own API key, then use it
        const apiKey = _params?.credentials?.apiKey;

        const openai = new OpenAI({
            apiKey,
            baseURL: process.env.TOGETHER_AI_API_URL || TOGETHER_AI_API_URL,
        });

        const chatCompletionArgs: OpenAI.ChatCompletionCreateParams & {
            top_k?: number;
            repetition_penalty?: number;
        } = {
            model: _params.model,
            messages,
        };

        if (_params?.maxTokens !== undefined) chatCompletionArgs.max_tokens = _params.maxTokens;
        if (_params?.temperature !== undefined) chatCompletionArgs.temperature = _params.temperature;
        if (_params?.topP !== undefined) chatCompletionArgs.top_p = _params.topP;
        if (_params?.topK !== undefined) chatCompletionArgs.top_k = _params.topK;
        if (_params?.frequencyPenalty !== undefined) chatCompletionArgs.repetition_penalty = _params.frequencyPenalty;
        if (_params?.stopSequences?.length) chatCompletionArgs.stop = _params.stopSequences;

        try {
            // Validate token limit
            const promptTokens = encodeChat(messages, 'gpt-4')?.length;

            await LLMRegistry.validateTokensLimit({
                model: _params?.model,
                promptTokens,
                completionTokens: _params?.maxTokens,
                hasAPIKey: !!apiKey,
            });

            const response = await openai.chat.completions.create(chatCompletionArgs as any);

            const content = response?.choices?.[0]?.message.content;
            const finishReason = response?.choices?.[0]?.finish_reason;

            return { content, finishReason };
        } catch (error) {
            throw error;
        }
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Vision requests are not supported by TogetherAI');
    }

    protected async multimodalRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Multimodal request is not supported for OpenAI.');
    }

    protected async imageGenRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent?: string | Agent): Promise<ImagesResponse> {
        throw new Error('Image generation request is not supported for TogetherAI.');
    }

    protected async toolRequest(acRequest: AccessRequest, params: TLLMParams): Promise<any> {
        const _params = { ...params };

        try {
            const apiKey = _params?.credentials?.apiKey;

            const openai = new OpenAI({
                apiKey,
                baseURL: process.env.TOGETHER_AI_API_URL || TOGETHER_AI_API_URL,
            });

            const messages = _params?.messages || [];

            let chatCompletionArgs: OpenAI.ChatCompletionCreateParamsNonStreaming = {
                model: _params.model,
                messages,
            };

            if (_params?.maxTokens !== undefined) chatCompletionArgs.max_tokens = _params.maxTokens;

            if (_params.toolsConfig?.tools) {
                chatCompletionArgs.tools = _params.toolsConfig?.tools as OpenAI.ChatCompletionTool[];
            }
            if (_params.toolsConfig?.tool_choice) {
                chatCompletionArgs.tool_choice = _params.toolsConfig?.tool_choice as OpenAI.ChatCompletionToolChoiceOption;
            }

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

    protected async streamToolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        throw new Error('streamToolRequest() is Deprecated!');
    }

    protected async streamRequest(acRequest: AccessRequest, params: TLLMParams): Promise<EventEmitter> {
        const _params = { ...params };
        const emitter = new EventEmitter();
        const apiKey = _params?.credentials?.apiKey;

        const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: process.env.TOGETHER_AI_API_URL || TOGETHER_AI_API_URL,
        });

        const messages = _params?.messages || [];

        let chatCompletionArgs: OpenAI.ChatCompletionCreateParamsStreaming = {
            model: _params.model,
            messages,
            stream: true,
        };

        if (_params?.maxTokens !== undefined) chatCompletionArgs.max_tokens = _params.maxTokens;

        if (_params.toolsConfig?.tools) {
            chatCompletionArgs.tools = _params.toolsConfig?.tools as OpenAI.ChatCompletionTool[];
        }
        if (_params.toolsConfig?.tool_choice) {
            chatCompletionArgs.tool_choice = _params.toolsConfig?.tool_choice as OpenAI.ChatCompletionToolChoiceOption;
        }

        try {
            const stream: any = await openai.chat.completions.create(chatCompletionArgs);

            let toolsData: ToolData[] = [];

            (async () => {
                for await (const part of stream) {
                    const delta = part.choices[0].delta;
                    emitter.emit('data', delta);

                    if (!delta?.tool_calls && delta?.content) {
                        emitter.emit('content', delta.content, delta.role);
                    }

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

    public getConsistentMessages(messages) {
        return messages.map((message) => {
            const _message = { ...message };
            let textContent = '';

            if (message?.parts) {
                textContent = message.parts.map((textBlock) => textBlock?.text || '').join(' ');
            } else if (Array.isArray(message?.content)) {
                textContent = message.content.map((textBlock) => textBlock?.text || '').join(' ');
            } else if (message?.content) {
                textContent = message.content as string;
            }

            _message.content = textContent;

            return _message;
        });
    }
}
