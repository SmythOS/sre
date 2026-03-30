import OpenAI from 'openai';
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
    ILLMRequestContext,
    TLLMPreparedParams,
    TLLMToolResultMessageBlock,
    TLLMFinishReason,
} from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { LLMConnector } from '../LLMConnector';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { Logger } from '@sre/helpers/Log.helper';
import { hookAsync } from '@sre/Core/HookService';

const logger = Logger('OpenRouterConnector');

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

type OpenRouterRequestBody = {
    model: string;
    messages: any[];
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    stop?: string[];
    stream?: boolean;
    tools?: any[];
    tool_choice?: string;
};

/**
 * OpenRouter LLM Connector
 *
 * OpenRouter is a unified gateway that provides access to 100+ models
 * (Mistral, Llama, Qwen, Gemma, DeepSeek, Command R+, and more) through
 * a single OpenAI-compatible API endpoint and a single API key.
 *
 * Why a dedicated connector instead of reusing OpenAIConnector:
 * - OpenRouter requires identifying headers (HTTP-Referer, X-Title) that
 *   the existing OpenAI connector has no mechanism to send.
 * - A dedicated connector surfaces clear, provider-specific error messages
 *   and log context, making debugging easier.
 * - It provides a foundation for future OpenRouter-specific features such as
 *   provider routing config, model fallback strategies, and cost tracking
 *   via the usage.cost field returned by OpenRouter responses.
 *
 * API compatibility: OpenRouter follows the OpenAI chat completions format,
 * so the request/response shape is identical. Streaming uses SSE exactly
 * like OpenAI, and tool calling is fully supported on models that expose it.
 */
export class OpenRouterConnector extends LLMConnector {
    public name = 'LLM:OpenRouter';

    // ── Client Factory ────────────────────────────────────────────────────────
    // A new client instance is created per-request so credentials are always
    // fresh from the vault and never cached stale across key rotations.
    private getClient(context: ILLMRequestContext): OpenAI {
        const apiKey = (context.credentials as BasicCredentials)?.apiKey;

        if (!apiKey) throw new Error('Please provide an API key for OpenRouter');

        return new OpenAI({
            apiKey,
            baseURL: OPENROUTER_BASE_URL,
            // OpenRouter requires these headers to identify the calling application.
            // HTTP-Referer is used for rate-limit attribution; X-Title appears in
            // the OpenRouter dashboard under "Your Apps".
            defaultHeaders: {
                'HTTP-Referer': 'https://smythos.com',
                'X-Title': 'SmythOS',
            },
        });
    }

    // ── Non-streaming request ─────────────────────────────────────────────────
    @hookAsync('LLMConnector.request')
    protected async request({ acRequest, body, context, abortSignal }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        try {
            logger.debug(`request ${this.name}`, acRequest.candidate);

            const client = this.getClient(context);
            const result = await client.chat.completions.create(body, { signal: abortSignal }) as any;

            const message = result?.choices?.[0]?.message;
            const finishReason = LLMHelper.normalizeFinishReason(result?.choices?.[0]?.finish_reason);
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
        } catch (error) {
            logger.error(`request ${this.name}`, error, acRequest.candidate);
            throw error;
        }
    }

    // ── Streaming request ─────────────────────────────────────────────────────
    /**
     * Stream request implementation.
     *
     * Error Handling Pattern:
     * - Always returns an emitter, never throws — ensures consistent handling upstream.
     * - Uses setImmediate to defer event emission to the next event loop tick.
     *   This prevents the race condition where events fire before the caller has
     *   had a chance to attach listeners (since streamRequest is async, the caller
     *   must await the emitter before attaching — setImmediate bridges that gap).
     * - Always emits TLLMEvent.End after any terminal event (Error, Abort).
     */
    @hookAsync('LLMConnector.streamRequest')
    protected async streamRequest({ acRequest, body, context, abortSignal }: ILLMRequestFuncParams): Promise<EventEmitter> {
        const emitter = new EventEmitter();

        try {
            logger.debug(`streamRequest ${this.name}`, acRequest.candidate);

            const client = this.getClient(context);
            const stream = await client.chat.completions.create(
                { ...body, stream: true },
                { signal: abortSignal }
            ) as any;

            let toolsData: ToolData[] = [];
            let finishReason: TLLMFinishReason = TLLMFinishReason.Stop;
            let usage: any = null;

            setImmediate(() => {
                (async () => {
                    try {
                        for await (const chunk of stream) {
                            const delta = chunk.choices[0]?.delta;

                            // OpenRouter streams usage in the final chunk
                            if (chunk.usage) {
                                usage = chunk.usage;
                            }

                            emitter.emit(TLLMEvent.Data, delta);

                            if (delta?.content) {
                                emitter.emit(TLLMEvent.Content, delta.content);
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

                            if (chunk.choices[0]?.finish_reason) {
                                finishReason = LLMHelper.normalizeFinishReason(chunk.choices[0].finish_reason);
                            }
                        }

                        if (toolsData.length > 0) {
                            emitter.emit(TLLMEvent.ToolInfo, toolsData);
                        }

                        const reportedUsage: any[] = [];
                        if (usage) {
                            const reported = this.reportUsage(usage, {
                                modelEntryName: context.modelEntryName,
                                keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                                agentId: context.agentId,
                                teamId: context.teamId,
                            });
                            reportedUsage.push(reported);
                        }

                        if (finishReason !== TLLMFinishReason.Stop) {
                            emitter.emit(TLLMEvent.Interrupted, finishReason);
                        }

                        setTimeout(() => {
                            emitter.emit(TLLMEvent.End, toolsData, reportedUsage, finishReason);
                        }, 100);
                    } catch (error: any) {
                        const isAbort = error?.name === 'AbortError' || abortSignal?.aborted;
                        if (isAbort) {
                            logger.debug(`streamRequest ${this.name} aborted`, error, acRequest.candidate);
                            const abortError = new DOMException('Request aborted', 'AbortError');
                            emitter.emit(TLLMEvent.Abort, abortError);
                            setImmediate(() => {
                                emitter.emit(TLLMEvent.End, [], [], TLLMFinishReason.Abort);
                            });
                        } else {
                            logger.error(`streamRequest ${this.name}`, error, acRequest.candidate);
                            emitter.emit(TLLMEvent.Error, error);
                            setImmediate(() => {
                                emitter.emit(TLLMEvent.End, [], [], TLLMFinishReason.Error);
                            });
                        }
                    }
                })();
            });

            return emitter;
        } catch (error: any) {
            const isAbort = error?.name === 'AbortError' || abortSignal?.aborted;

            if (isAbort) {
                const abortError = new DOMException('Request aborted', 'AbortError');
                logger.debug(`streamRequest ${this.name} aborted`, abortError, acRequest.candidate);
                setImmediate(() => {
                    emitter.emit(TLLMEvent.Abort, abortError);
                    emitter.emit(TLLMEvent.End, [], [], TLLMFinishReason.Abort);
                });
                return emitter;
            }

            logger.error(`streamRequest ${this.name}`, error, acRequest.candidate);
            setImmediate(() => {
                emitter.emit(TLLMEvent.Error, error);
                emitter.emit(TLLMEvent.End, [], [], TLLMFinishReason.Error);
            });
            return emitter;
        }
    }

    // ── Request body adapter ──────────────────────────────────────────────────
    // Maps SmythOS normalised params → OpenRouter request body.
    // OpenRouter accepts the full OpenAI chat completions schema, so the mapping
    // is straightforward with no provider-specific quirks.
    protected async reqBodyAdapter(params: TLLMPreparedParams): Promise<OpenRouterRequestBody> {
        const messages = params?.messages || [];

        if (params?.responseFormat === 'json') {
            if (messages?.[0]?.role === 'system') {
                messages[0].content += JSON_RESPONSE_INSTRUCTION;
            } else {
                messages.unshift({ role: 'system', content: JSON_RESPONSE_INSTRUCTION });
            }
        }

        const body: OpenRouterRequestBody = {
            model: params.model as string,
            messages,
        };

        if (params.maxTokens !== undefined) body.max_tokens = params.maxTokens;
        if (params.temperature !== undefined) body.temperature = params.temperature;
        if (params.topP !== undefined) body.top_p = params.topP;
        if (params.stopSequences?.length) body.stop = params.stopSequences;
        if (params.toolsConfig?.tools) body.tools = params.toolsConfig.tools;
        if (params.toolsConfig?.tool_choice) body.tool_choice = params.toolsConfig.tool_choice as string;

        return body;
    }

    // ── Usage reporting ───────────────────────────────────────────────────────
    protected reportUsage(
        usage: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } },
        metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }
    ) {
        const modelName = metadata.modelEntryName.replace(BUILT_IN_MODEL_PREFIX, '');

        const usageData = {
            sourceId: `llm:${modelName}`,
            input_tokens: (usage?.prompt_tokens || 0) - (usage?.prompt_tokens_details?.cached_tokens || 0),
            output_tokens: usage?.completion_tokens || 0,
            input_tokens_cache_write: 0,
            input_tokens_cache_read: usage?.prompt_tokens_details?.cached_tokens || 0,
            keySource: metadata.keySource,
            agentId: metadata.agentId,
            teamId: metadata.teamId,
        };

        SystemEvents.emit('USAGE:LLM', usageData);
        return usageData;
    }

    // ── Tool support ──────────────────────────────────────────────────────────
    // OpenRouter supports OpenAI-style function calling on models that expose it
    // (e.g. Mistral Large, Llama 3.3 70B, Qwen 2.5). The format is identical to
    // the OpenAI/Groq tool calling schema.
    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto' }) {
        if (type !== 'function') return {};

        const tools = toolDefinitions.map(({ name, description, properties, requiredFields }) => ({
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
        }));

        return tools.length > 0 ? { tools, tool_choice: toolChoice } : {};
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
                for (const toolCall of transformedMessageBlock.tool_calls) {
                    toolCall.function.arguments =
                        typeof toolCall.function.arguments === 'object'
                            ? JSON.stringify(toolCall.function.arguments)
                            : toolCall.function.arguments;
                }
            }
            messageBlocks.push(transformedMessageBlock);
        }

        const transformedToolsData = toolsData.map((toolData) => ({
            tool_call_id: toolData.id,
            role: TLLMMessageRole.Tool,
            name: toolData.name,
            content: typeof toolData.result === 'string' ? toolData.result : JSON.stringify(toolData.result),
        }));

        return [...messageBlocks, ...transformedToolsData];
    }

    // ── Message normalisation ─────────────────────────────────────────────────
    // Strips multimodal parts (images, audio) down to plain text since not all
    // OpenRouter-hosted models support multimodal input. Models that do support
    // vision can be handled via future feature flags in the model entry.
    public getConsistentMessages(messages: TLLMMessageBlock[]): TLLMMessageBlock[] {
        return LLMHelper.removeDuplicateUserMessages(messages).map((message) => {
            const _message = { ...message };

            if (message?.parts) {
                _message.content = message.parts.map((block) => block?.text || '').join(' ');
            } else if (Array.isArray(message?.content)) {
                _message.content = message.content.map((block) => block?.text || '').join(' ');
            }

            return _message;
        });
    }
}
