import Groq from 'groq-sdk';
import EventEmitter from 'events';

import Agent from '@sre/AgentManager/Agent.class';
import { TOOL_USE_DEFAULT_MODEL, JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { TLLMMessageBlock, ToolData, TLLMMessageRole } from '@sre/types/LLM.types';

import { LLMChatResponse, LLMConnector } from '../LLMConnector';

const console = Logger('GroqConnector');

type ChatCompletionCreateParams = {
    model: string;
    messages: any;
    max_tokens?: number;
    temperature?: number;
    stop?: string[];
    top_p?: number;
    tools?: any;
    tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
    stream?: boolean;
};

type ToolRequestParams = {
    model: string;
    messages: TLLMMessageBlock[];
    toolsConfig: { tools: ToolData[]; tool_choice: string };
    apiKey: string;
};

// TODO [Forhad]: Apply proper types at for function params and return value

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
            _params.messages.push({ role: TLLMMessageRole.User, content: prompt });
        }

        const apiKey = _params?.apiKey;
        if (!apiKey) throw new Error('Please provide an API key for Groq');

        const groq = new Groq({ apiKey });

        // TODO: implement groq specific token counting
        // this.validateTokensLimit(_params);

        const chatCompletionArgs: ChatCompletionCreateParams = {
            model: _params.model,
            messages: this.getConsistentMessages(_params.messages),
        };

        if (_params.max_tokens) chatCompletionArgs.max_tokens = _params.max_tokens;
        if (_params.temperature) chatCompletionArgs.temperature = _params.temperature;
        if (_params.stop) chatCompletionArgs.stop = _params.stop;
        if (_params.top_p) chatCompletionArgs.top_p = _params.top_p;

        try {
            const response: any = await groq.chat.completions.create(chatCompletionArgs);
            const content = response.choices[0]?.message?.content;
            const finishReason = response.choices[0]?.finish_reason;

            return { content, finishReason };
        } catch (error) {
            throw error;
        }
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Vision requests are not supported by Groq');
    }

    protected async multimodalRequest(acRequest: AccessRequest, prompt, params: any, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Multimodal request is not supported for OpenAI.');
    }

    protected async toolRequest(acRequest: AccessRequest, params: ToolRequestParams): Promise<any> {
        const _params = { ...params };

        try {
            const groq = new Groq({ apiKey: _params.apiKey || process.env.GROQ_API_KEY });

            const _messages = this.getConsistentMessages(_params.messages);

            let args = {
                model: _params.model,
                messages: _messages,
                tools: _params.toolsConfig.tools,
                tool_choice: _params.toolsConfig.tool_choice,
            };

            const result = await groq.chat.completions.create(args as any);
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
                    role: TLLMMessageRole.Assistant,
                }));
                useTool = true;
            }

            return {
                data: { useTool, message, content: message?.content ?? '', toolsData },
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

    protected async streamRequest(acRequest: AccessRequest, params): Promise<EventEmitter> {
        const _params = { ...params };
        const emitter = new EventEmitter();
        const groq = new Groq({ apiKey: _params.apiKey || process.env.GROQ_API_KEY });

        let chatCompletionArgs: ChatCompletionCreateParams = {
            model: _params.model,
            messages: _params.messages,
            stream: true,
        };

        if (_params.toolsConfig?.tools) chatCompletionArgs.tools = _params.toolsConfig?.tools;
        if (_params.toolsConfig?.tool_choice) chatCompletionArgs.tool_choice = _params.toolsConfig?.tool_choice;

        try {
            const stream = await groq.chat.completions.create(chatCompletionArgs);

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
            throw error;
        }
    }

    public async extractVisionLLMParams(config: any) {
        const params = await super.extractVisionLLMParams(config);

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

    private getConsistentMessages(messages: TLLMMessageBlock[]): TLLMMessageBlock[] {
        if (messages.length === 0) return messages;

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
