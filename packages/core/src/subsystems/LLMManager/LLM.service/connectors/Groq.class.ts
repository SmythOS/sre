import Groq from 'groq-sdk';
import EventEmitter from 'events';

import Agent from '@sre/AgentManager/Agent.class';
import { TOOL_USE_DEFAULT_MODEL, JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { TLLMParams, TLLMMessageBlock, ToolData, TLLMMessageRole } from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';

import { ImagesResponse, LLMChatResponse, LLMConnector } from '../LLMConnector';

const console = Logger('GroqConnector');

type ChatCompletionCreateParams = {
    model: string;
    messages: any;
    max_tokens?: number;
    temperature?: number;
    stop?: string[];
    top_p?: number;
    tools?: any;
    tool_choice?: string;
    stream?: boolean;
};

type ToolRequestParams = {
    model: string;
    messages: TLLMMessageBlock[];
    toolsConfig: { tools: ToolData[]; tool_choice: string };
    credentials: { apiKey: string };
};

// TODO [Forhad]: Apply proper types at for function params and return value

export class GroqConnector extends LLMConnector {
    public name = 'LLM:Groq';

    protected async chatRequest(acRequest: AccessRequest, params: TLLMParams): Promise<LLMChatResponse> {
        let messages = params?.messages || [];

        //#region Handle JSON response format
        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            if (messages?.[0]?.role === 'system') {
                messages[0].content += JSON_RESPONSE_INSTRUCTION;
            } else {
                messages.unshift({ role: 'system', content: JSON_RESPONSE_INSTRUCTION });
            }
        }
        //#endregion Handle JSON response format

        const apiKey = params?.credentials?.apiKey;
        if (!apiKey) throw new Error('Please provide an API key for Groq');

        const groq = new Groq({ apiKey });

        // TODO: implement groq specific token counting
        // this.validateTokensLimit(params);

        const chatCompletionArgs: {
            model: string;
            messages: any; // TODO [Forhad]: apply proper typing
            max_tokens?: number;
            temperature?: number;
            top_p?: number;
            stop?: string[];
        } = {
            model: params.model,
            messages,
        };

        if (params.maxTokens !== undefined) chatCompletionArgs.max_tokens = params.maxTokens;
        if (params.temperature !== undefined) chatCompletionArgs.temperature = params.temperature;
        if (params.topP !== undefined) chatCompletionArgs.top_p = params.topP;
        if (params.stopSequences?.length) chatCompletionArgs.stop = params.stopSequences;

        try {
            const response: any = await groq.chat.completions.create(chatCompletionArgs);
            const content = response.choices[0]?.message?.content;
            const finishReason = response.choices[0]?.finish_reason;

            return { content, finishReason };
        } catch (error) {
            throw error;
        }
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Vision requests are not supported by Groq');
    }

    protected async multimodalRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Multimodal request is not supported for OpenAI.');
    }

    protected async toolRequest(acRequest: AccessRequest, params: TLLMParams): Promise<any> {
        try {
            const apiKey = params?.credentials?.apiKey;

            const groq = new Groq({ apiKey });

            const messages = params?.messages || [];

            let chatCompletionArgs: ChatCompletionCreateParams = {
                model: params.model,
                messages,
            };

            if (params.maxTokens) chatCompletionArgs.max_tokens = params.maxTokens;

            if (params?.toolsConfig?.tools) chatCompletionArgs.tools = params?.toolsConfig?.tools;
            if (params?.toolsConfig?.tool_choice) chatCompletionArgs.tool_choice = params?.toolsConfig?.tool_choice as any; // TODO [Forhad]: apply proper typing

            const result = await groq.chat.completions.create(chatCompletionArgs as any); // TODO [Forhad]: apply proper typing
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

    protected async imageGenRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent?: string | Agent): Promise<ImagesResponse> {
        throw new Error('Image generation request is not supported for Groq.');
    }

    // ! DEPRECATED METHOD
    protected async streamToolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        throw new Error('streamToolRequest() is Deprecated!');
    }

    protected async streamRequest(acRequest: AccessRequest, params: TLLMParams): Promise<EventEmitter> {
        const emitter = new EventEmitter();
        const apiKey = params?.credentials?.apiKey;

        const groq = new Groq({ apiKey });

        const messages = params?.messages || [];

        let chatCompletionArgs: {
            model: string;
            messages: any; // TODO [Forhad]: apply proper typing
            max_tokens?: number;
            tools?: any; // TODO [Forhad]: apply proper typing
            tool_choice?: any; // TODO [Forhad]: apply proper typing
            stream?: boolean;
        } = {
            model: params.model,
            messages,
            stream: true,
        };

        if (params?.maxTokens !== undefined) chatCompletionArgs.max_tokens = params.maxTokens;

        if (params.toolsConfig?.tools) chatCompletionArgs.tools = params.toolsConfig?.tools;
        if (params.toolsConfig?.tool_choice) chatCompletionArgs.tool_choice = params.toolsConfig?.tool_choice;

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

    public getConsistentMessages(messages: TLLMMessageBlock[]): TLLMMessageBlock[] {
        const _messages = LLMHelper.removeDuplicateUserMessages(messages);

        return _messages.map((message) => {
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
