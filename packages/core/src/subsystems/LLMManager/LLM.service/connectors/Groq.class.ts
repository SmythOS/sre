import Groq from 'groq-sdk';
import EventEmitter from 'events';

import Agent from '@sre/AgentManager/Agent.class';
import { TOOL_USE_DEFAULT_MODEL, JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { LLMParams, LLMMessageBlock, ToolData } from '@sre/types/LLM.types';

import { LLMChatResponse, LLMConnector } from '../LLMConnector';

const console = Logger('GroqConnector');

type ChatCompletionCreateParams = {
    model: string;
    messages: any;
    max_tokens?: number;
    temperature?: number;
    stop?: string[];
    top_p?: number;
};

export class GroqConnector extends LLMConnector {
    public name = 'LLM:Groq';

    protected async chatRequest(acRequest: AccessRequest, prompt, params): Promise<LLMChatResponse> {
        const _params = { ...params };

        _params.messages = _params?.messages || [];

        if (this.hasSystemMessage(_params.messages)) {
            const { systemMessage, otherMessages } = this.separateSystemMessages(_params.messages);
            _params.messages = [systemMessage, ...otherMessages];
        } else {
            _params.messages.unshift({
                role: 'system',
                content: JSON_RESPONSE_INSTRUCTION,
            });
        }

        if (prompt) {
            _params.messages.push({ role: 'user', content: prompt });
        }

        const apiKey = _params?.apiKey;
        if (!apiKey) throw new Error('Please provide an API key for Groq');

        const groq = new Groq({ apiKey });

        // TODO: implement groq specific token counting
        // this.validateTokensLimit(_params);

        const chatCompletionCreateParams: ChatCompletionCreateParams = {
            model: _params.model,
            messages: _params.messages,
        };

        if (_params.max_tokens) chatCompletionCreateParams.max_tokens = _params.max_tokens;
        if (_params.temperature) chatCompletionCreateParams.temperature = _params.temperature;
        if (_params.stop) chatCompletionCreateParams.stop = _params.stop;
        if (_params.top_p) chatCompletionCreateParams.top_p = _params.top_p;

        try {
            const response: any = await groq.chat.completions.create(chatCompletionCreateParams);
            const content = response.choices[0]?.message?.content;
            const finishReason = response.choices[0]?.finish_reason;

            return { content, finishReason };
        } catch (error) {
            console.log('Error in chatRequest in Groq: ', error);
            throw error;
        }
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Vision requests are not supported by Groq');
    }

    protected async toolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        try {
            const groq = new Groq({ apiKey: apiKey || process.env.GROQ_API_KEY });

            if (!Array.isArray(messages) || !messages?.length) {
                return { error: new Error('Invalid messages argument for chat completion.') };
            }

            let args = {
                model,
                messages,
                tools,
                tool_choice,
            };

            const result = await groq.chat.completions.create(args);
            const message = result?.choices?.[0]?.message;
            const toolCalls = message?.tool_calls;

            let toolsData: ToolData[] = [];
            let useTool = false;

            if (toolCalls) {
                toolsData = toolCalls.map((tool, index) => ({
                    index,
                    id: tool.id,
                    type: tool.type,
                    name: tool.function.name,
                    arguments: tool.function.arguments,
                    role: 'assistant',
                }));
                useTool = true;
            }

            return {
                data: { useTool, message, content: message?.content ?? '', toolsData },
            };
        } catch (error: any) {
            console.error('Error on toolUseLLMRequest: ', error);
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
        const groq = new Groq({ apiKey: apiKey || process.env.GROQ_API_KEY });

        let args = {
            model,
            messages,
            tools,
            tool_choice,
            stream: true,
        };

        try {
            const stream = await groq.chat.completions.create(args);

            let toolsData: ToolData[] = [];

            (async () => {
                for await (const chunk of stream as any) {
                    const delta = chunk.choices[0]?.delta;
                    emitter.emit('data', delta);

                    if (delta?.content) {
                        emitter.emit('content', delta.content);
                    }

                    if (delta?.tool_calls) {
                        delta.tool_calls.forEach((toolCall, index) => {
                            if (!toolsData[index]) {
                                toolsData[index] = {
                                    index,
                                    id: toolCall.id,
                                    type: toolCall.type,
                                    name: toolCall.function?.name,
                                    arguments: toolCall.function?.arguments,
                                    role: 'assistant',
                                };
                            } else {
                                toolsData[index].arguments += toolCall.function?.arguments || '';
                            }
                        });
                    }
                }

                if (toolsData.length > 0) {
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
        let tools = [];

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

        return tools?.length > 0 ? { tools, tool_choice: toolChoice } : {};
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
