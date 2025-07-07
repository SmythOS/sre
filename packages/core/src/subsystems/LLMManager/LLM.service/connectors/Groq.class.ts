import EventEmitter from 'events';

import { JSON_RESPONSE_INSTRUCTION, BUILT_IN_MODEL_PREFIX } from '@sre/constants';
import {
    TLLMMessageBlock,
    ToolData,
    TLLMMessageRole,
    APIKeySource,
    TLLMEvent,
    BasicCredentials,
    ILLMRequestFuncParams,
    TLLMChatResponse,
    TLLMParams,
    TLLMConnectorParams,
    ILLMRequestContext,
} from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';

import { LLMConnector } from '../LLMConnector';
import { SystemEvents } from '@sre/Core/SystemEvents';

import { LazyLoadFallback } from '@sre/utils/lazy-client';
import type * as GroqTypes from 'groq-sdk';

let GroqModule: typeof GroqTypes | undefined;
//#IFDEF STATIC GROQ_STATIC
import * as _GroqModule from 'groq-sdk';
GroqModule = _GroqModule;
//#ENDIF

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

export class GroqConnector extends LLMConnector {
    public name = 'LLM:Groq';

    private async getClient(params: ILLMRequestContext): Promise<GroqTypes.Groq> {
        const { Groq } = await LazyLoadFallback<typeof GroqModule>(GroqModule, 'groq-sdk');
        const apiKey = (params.credentials as BasicCredentials)?.apiKey;

        if (!apiKey) throw new Error('Please provide an API key for Groq');

        return new Groq({ apiKey });
    }

    protected async request({ acRequest, body, context }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        try {
            const groq = await this.getClient(context);
            const result = await groq.chat.completions.create(body);
            const message = result?.choices?.[0]?.message;
            const finishReason = result?.choices?.[0]?.finish_reason;
            const toolCalls = message?.tool_calls;
            const usage = result.usage;
            this.reportUsage(usage, {
                modelEntryName: context.modelEntryName,
                keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId: context.agentId,
                teamId: context.teamId,
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
                content: message?.content ?? '',
                finishReason,
                useTool,
                toolsData,
                message,
                usage,
            };
        } catch (error: any) {
            throw error;
        }
    }

    protected async streamRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        const emitter = new EventEmitter();
        const usage_data = [];

        try {
            const groq = await this.getClient(context);
            const stream = await groq.chat.completions.create({ ...body, stream: true, stream_options: { include_usage: true } });

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
                    emitter.emit(TLLMEvent.ToolInfo, toolsData);
                }

                usage_data.forEach((usage) => {
                    // probably we can acc them and send them as one event
                    this.reportUsage(usage, {
                        modelEntryName: context.modelEntryName,
                        keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                        agentId: context.agentId,
                        teamId: context.teamId,
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

    protected async webSearchRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        throw new Error('Web search is not supported for Groq');
    }

    protected async reqBodyAdapter(params: TLLMParams): Promise<ChatCompletionCreateParams> {
        const messages = params?.messages || [];

        const body: ChatCompletionCreateParams = {
            model: params.model as string,
            messages,
        };

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

        if (params.maxTokens !== undefined) body.max_tokens = params.maxTokens;
        if (params.temperature !== undefined) body.temperature = params.temperature;
        if (params.topP !== undefined) body.top_p = params.topP;
        if (params.stopSequences?.length) body.stop = params.stopSequences;

        if (params.toolsConfig?.tools) body.tools = params.toolsConfig?.tools;
        if (params.toolsConfig?.tool_choice) body.tool_choice = params.toolsConfig?.tool_choice as any;

        return body;
    }

    protected reportUsage(
        usage: GroqTypes.Groq.Completions.CompletionUsage & { prompt_tokens_details?: { cached_tokens?: number } },
        metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }
    ) {
        // SmythOS (built-in) models have a prefix, so we need to remove it to get the model name
        const modelName = metadata.modelEntryName.replace(BUILT_IN_MODEL_PREFIX, '');

        const usageData = {
            sourceId: `llm:${modelName}`,
            input_tokens: usage?.prompt_tokens - (usage?.prompt_tokens_details?.cached_tokens || 0),
            output_tokens: usage?.completion_tokens,
            input_tokens_cache_write: 0,
            input_tokens_cache_read: usage?.prompt_tokens_details?.cached_tokens || 0,
            keySource: metadata.keySource,
            agentId: metadata.agentId,
            teamId: metadata.teamId,
        };
        SystemEvents.emit('USAGE:LLM', usageData);

        return usageData;
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
