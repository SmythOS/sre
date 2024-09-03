import Groq from 'groq-sdk';
import EventEmitter from 'events';

import Agent from '@sre/AgentManager/Agent.class';
import { TOOL_USE_DEFAULT_MODEL, JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { LLMParams, LLMMessageBlock, ToolData } from '@sre/types/LLM.types';

import { LLMChatResponse, LLMConnector } from '../LLMConnector';

const console = Logger('GroqConnector');

export class GroqConnector extends LLMConnector {
    public name = 'LLM:Groq';

    protected async chatRequest(acRequest: AccessRequest, prompt, params): Promise<LLMChatResponse> {
        try {
            params.messages = params?.messages || [];

            if (this.hasSystemMessage(params.messages)) {
                const { systemMessage, otherMessages } = this.separateSystemMessages(params.messages);
                params.messages = [systemMessage, ...otherMessages];
            } else {
                params.messages.unshift({
                    role: 'system',
                    content: JSON_RESPONSE_INSTRUCTION,
                });
            }

            if (prompt) {
                params.messages.push({ role: 'user', content: prompt });
            }

            const apiKey = params?.apiKey;
            if (!apiKey) throw new Error('Please provide an API key for Groq');

            const groq = new Groq({ apiKey });

            // TODO: implement groq specific token counting
            // this.validateTokensLimit(params);

            const response: any = await groq.chat.completions.create(params);
            const content = response.choices[0]?.message?.content;
            const finishReason = response.choices[0]?.finish_reason;

            return { content, finishReason };
        } catch (error) {
            console.error('Error in groq chatRequest', error);
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
