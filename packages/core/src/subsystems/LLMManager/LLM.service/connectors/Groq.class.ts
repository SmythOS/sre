import Groq from 'groq-sdk';
import EventEmitter from 'events';

import Agent from '@sre/AgentManager/Agent.class';
import { TOOL_USE_DEFAULT_MODEL, JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { TLLMParams, TLLMMessageBlock, ToolData, TLLMMessageRole, APIKeySource } from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';

import { ImagesResponse, LLMChatResponse, LLMConnector } from '../LLMConnector';
import SystemEvents from '@sre/Core/SystemEvents';

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

    protected async chatRequest(acRequest: AccessRequest, params: TLLMParams, agent: string | Agent): Promise<LLMChatResponse> {
        let messages = params?.messages || [];

        const agentId = agent instanceof Agent ? agent.id : agent;

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
            const response = await groq.chat.completions.create(chatCompletionArgs);
            const content = response.choices[0]?.message?.content;
            const finishReason = response.choices[0]?.finish_reason;
            const usage = response.usage;

            this.reportUsage(usage, {
                model: params.model,
                modelEntryName: params.modelEntryName,
                keySource: params.credentials.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId,
                teamId: params.teamId,
            });

            return { content, finishReason };
        } catch (error) {
            throw error;
        }
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Vision requests are not supported by Groq');
    }

    protected async multimodalRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Multimodal request is not supported for Groq.');
    }

    protected async toolRequest(acRequest: AccessRequest, params: TLLMParams, agent: string | Agent): Promise<any> {
        try {
            const apiKey = params?.credentials?.apiKey;

            const groq = new Groq({ apiKey });

            const messages = params?.messages || [];

            const agentId = agent instanceof Agent ? agent.id : agent;

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
            const usage = result.usage;
            this.reportUsage(usage, {
                model: params.model,
                modelEntryName: params.modelEntryName,
                keySource: params.credentials.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId,
                teamId: params.teamId,
            });

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

    protected async imageGenRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent: string | Agent): Promise<ImagesResponse> {
        throw new Error('Image generation request is not supported for Groq.');
    }

    // ! DEPRECATED METHOD
    protected async streamToolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        throw new Error('streamToolRequest() is Deprecated!');
    }

    protected async streamRequest(acRequest: AccessRequest, params: TLLMParams, agent: string | Agent): Promise<EventEmitter> {
        const emitter = new EventEmitter();
        const usage_data = [];
        const apiKey = params?.credentials?.apiKey;

        const groq = new Groq({ apiKey });

        const messages = params?.messages || [];

        const agentId = agent instanceof Agent ? agent.id : agent;

        let chatCompletionArgs: {
            model: string;
            messages: any; // TODO [Forhad]: apply proper typing
            max_tokens?: number;
            tools?: any; // TODO [Forhad]: apply proper typing
            tool_choice?: any; // TODO [Forhad]: apply proper typing
            stream?: boolean;
            stream_options?: { include_usage: boolean };
        } = {
            model: params.model,
            messages,
            stream: true,
            stream_options: { include_usage: true },
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
                    const usage = chunk['x_groq']?.usage || chunk['usage'];

                    if (usage) {
                        usage_data.push(usage);
                    }
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

                usage_data.forEach((usage) => {
                    // probably we can acc them and send them as one event
                    this.reportUsage(usage, {
                        model: params.model,
                        modelEntryName: params.modelEntryName,
                        keySource: params.credentials.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                        agentId,
                        teamId: params.teamId,
                    });
                });

                setTimeout(() => {
                    emitter.emit('end', toolsData);
                }, 100);
            })();

            return emitter;
        } catch (error: any) {
            throw error;
        }
    }

    protected async multimodalStreamRequest(acRequest: AccessRequest, params: any): Promise<EventEmitter> {
        throw new Error('Groq model does not support passthrough with File(s)');
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

    protected reportUsage(
        usage: Groq.Completions.CompletionUsage & { prompt_tokens_details?: { cached_tokens?: number } },
        metadata: { model: string; modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }
    ) {
        SystemEvents.emit('USAGE:LLM', {
            input_tokens: usage?.prompt_tokens - (usage?.prompt_tokens_details?.cached_tokens || 0),
            output_tokens: usage?.completion_tokens,
            input_tokens_cache_write: 0,
            input_tokens_cache_read: usage?.prompt_tokens_details?.cached_tokens || 0,
            llm_provider: metadata.modelEntryName,
            model: metadata.model,
            keySource: metadata.keySource,
            agentId: metadata.agentId,
            teamId: metadata.teamId,
        });
    }
}
