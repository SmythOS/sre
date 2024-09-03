import OpenAI from 'openai';
import config from '@sre/config';
import Agent from '@sre/AgentManager/Agent.class';
import { JSON_RESPONSE_INSTRUCTION, TOOL_USE_DEFAULT_MODEL } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { LLMParams, LLMMessageBlock, ToolData } from '@sre/types/LLM.types';
import { LLMChatResponse, LLMConnector } from '../LLMConnector';
import EventEmitter from 'events';

const console = Logger('TogetherAIConnector');

const TOGETHER_AI_API_URL = 'https://api.together.xyz/v1';

export class TogetherAIConnector extends LLMConnector {
    public name = 'LLM:TogetherAI';

    protected async chatRequest(acRequest: AccessRequest, prompt, params): Promise<LLMChatResponse> {
        try {
            if (!params.messages) params.messages = [];

            if (params.messages[0]?.role !== 'system') {
                params.messages.unshift({
                    role: 'system',
                    content: JSON_RESPONSE_INSTRUCTION,
                });
            }

            if (prompt) {
                params.messages.push({ role: 'user', content: prompt });
            }

            params.messages = this.formatInputMessages(params.messages);

            const apiKey = params?.apiKey;
            delete params.apiKey;

            const openai = new OpenAI({
                apiKey: apiKey || process.env.TOGETHER_AI_API_KEY,
                baseURL: config.env.TOGETHER_AI_API_URL || TOGETHER_AI_API_URL,
            });

            // TODO: implement together.ai specific token counting
            // this.validateTokensLimit(params);

            const response: any = await openai.chat.completions.create(params);

            const content =
                response?.choices?.[0]?.text ||
                response?.choices?.[0]?.message.content ||
                response?.data?.choices?.[0]?.text ||
                response?.data?.choices?.[0]?.message.content;

            const finishReason = response?.choices?.[0]?.finish_reason;

            return { content, finishReason };
        } catch (error) {
            console.error('Error in TogetherAI chatRequest', error);
            throw error;
        }
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Vision requests are not supported by TogetherAI');
    }

    protected async toolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        try {
            const openai = new OpenAI({
                apiKey: apiKey || process.env.TOGETHER_AI_API_KEY,
                baseURL: config.env.TOGETHER_AI_API_URL || TOGETHER_AI_API_URL,
            });

            if (!Array.isArray(messages) || !messages?.length) {
                return { error: new Error('Invalid messages argument for chat completion.') };
            }

            let args: OpenAI.ChatCompletionCreateParamsNonStreaming = {
                model,
                messages,
                tools,
                tool_choice,
            };

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
        throw new Error('streamToolRequest() is Deprecated!');
    }

    protected async streamRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<EventEmitter> {
        const emitter = new EventEmitter();
        const openai = new OpenAI({
            apiKey: apiKey || process.env.TOGETHER_AI_API_KEY,
            baseURL: config.env.TOGETHER_AI_API_URL || TOGETHER_AI_API_URL,
        });

        let args: OpenAI.ChatCompletionCreateParamsStreaming = {
            model,
            messages,
            tools,
            tool_choice,
            stream: true,
        };

        try {
            const stream: any = await openai.chat.completions.create(args);

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
            emitter.emit('error', error);
            return emitter;
        }
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

    private formatInputMessages(messages: LLMMessageBlock[]): LLMMessageBlock[] {
        return messages.map((message) => {
            let textContent = '';

            if (Array.isArray(message.content)) {
                textContent = message.content.map((textBlock) => textBlock?.text || '').join(' ');
            } else if (typeof message.content === 'string') {
                textContent = message.content;
            }

            return {
                role: message.role,
                content: textContent,
            };
        });
    }
}
