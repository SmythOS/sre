import EventEmitter from 'events';
import axios, { AxiosInstance } from 'axios';

import { JSON_RESPONSE_INSTRUCTION, BUILT_IN_MODEL_PREFIX } from '@sre/constants';

import {
    TLLMParams,
    ToolData,
    TLLMMessageBlock,
    TLLMToolResultMessageBlock,
    TLLMMessageRole,
    APIKeySource,
    BasicCredentials,
    ILLMRequestFuncParams,
    TLLMChatResponse,
    ILLMRequestContext,
    TLLMEvent,
    TLLMFinishReason,
} from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';

import { LLMConnector } from '../LLMConnector';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { Logger } from '@sre/helpers/Log.helper';
import { hookAsync } from '@sre/Core/HookService';

const logger = Logger('xAIConnector');

type ChatCompletionParams = {
    model: string;
    messages: any[];
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stop?: string | string[];
    response_format?: { type: string };
    stream?: boolean;
    stream_options?: { include_usage: boolean };
    tools?: any[];
    tool_choice?: any;
    // xAI search parameters - nested structure
    search_parameters?: {
        mode?: 'auto' | 'on' | 'off';
        return_citations?: boolean;
        max_search_results?: number;
        sources?: Array<{
            type: 'web' | 'x' | 'news' | 'rss';
            country?: string;
            excluded_websites?: string[];
            allowed_websites?: string[];
            safe_search?: boolean;
            included_x_handles?: string[];
            excluded_x_handles?: string[];
            post_favorite_count?: number;
            post_view_count?: number;
            links?: string[];
        }>;
        from_date?: string;
        to_date?: string;
    };
};

type TUsage = {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: {
        text_tokens?: number;
        audio_tokens?: number;
        image_tokens?: number;
        cached_tokens?: number;
    };
    completion_tokens_details?: {
        reasoning_tokens?: number;
        audio_tokens?: number;
        accepted_prediction_tokens?: number;
        rejected_prediction_tokens?: number;
    };
    reasoning_tokens?: number; // for backward compatibility
    num_sources_used?: number;
};

export class xAIConnector extends LLMConnector {
    public name = 'LLM:Grok';

    private async getClient(params: ILLMRequestContext): Promise<AxiosInstance> {
        const apiKey = (params.credentials as BasicCredentials)?.apiKey;
        const baseURL = params?.modelInfo?.baseURL || 'https://api.x.ai/v1';

        if (!apiKey) throw new Error('Please provide an API key for Grok');

        return axios.create({
            baseURL,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });
    }

    @hookAsync('LLMConnector.request')
    protected async request({ acRequest, body, context, abortSignal }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        try {
            logger.debug(`request ${this.name}`, acRequest.candidate);
            const grok = await this.getClient(context);
            const response = await grok.post('/chat/completions', body, { signal: abortSignal });

            const message = response?.data?.choices?.[0]?.message;
            const finishReason = LLMHelper.normalizeFinishReason(response?.data?.choices?.[0]?.finish_reason);
            const usage = response?.data?.usage as TUsage;
            const citations = response?.data?.citations;

            let toolsData: ToolData[] = [];
            let useTool = false;

            if (finishReason === TLLMFinishReason.ToolCalls) {
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

            // Handle citations from live search
            let content = message?.content ?? '';
            if (citations && citations.length > 0) {
                const citationsText = '\n\n**Sources:**\n' + citations.map((url, index) => `${index + 1}. ${url}`).join('\n');
                content += citationsText;
            }

            this.reportUsage(usage, {
                modelEntryName: context.modelEntryName,
                keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId: context.agentId,
                teamId: context.teamId,
            });

            return {
                content,
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

    @hookAsync('LLMConnector.streamRequest')
    protected async streamRequest({ acRequest, body, context, abortSignal }: ILLMRequestFuncParams): Promise<EventEmitter> {
        const emitter = new EventEmitter();

        try {
            logger.debug(`streamRequest ${this.name}`, acRequest.candidate);
            const grok = await this.getClient(context);
            const response = await grok.post(
                '/chat/completions',
                { ...body, stream: true, stream_options: { include_usage: true } },
                {
                    responseType: 'stream',
                    signal: abortSignal,
                }
            );

            const reportedUsage: any[] = [];
            let finishReason: TLLMFinishReason = TLLMFinishReason.Stop;
            let toolsData: any[] = [];
            let usage: any = {};
            let citations: any[] = [];

            response.data.on('data', (chunk) => {
                const lines = chunk.toString().split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            // Handle stream completion
                            continue;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices?.[0]?.delta;

                            // Usage data comes in final chunk when stream_options.include_usage is true
                            if (parsed?.usage) {
                                usage = parsed.usage;
                            }

                            // Handle citations from xAI - they come at the top level as an array of URLs
                            if (parsed.citations) {
                                citations = parsed.citations;
                            }

                            if (delta) {
                                emitter.emit(TLLMEvent.Data, delta);

                                if (delta.content) {
                                    emitter.emit(TLLMEvent.Content, delta.content, delta.role);
                                }

                                if (delta.tool_calls) {
                                    const toolCall = delta.tool_calls[0];
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

                            if (parsed.choices?.[0]?.finish_reason) {
                                finishReason = LLMHelper.normalizeFinishReason(parsed.choices[0].finish_reason);
                            }
                        } catch (e) {
                            // Ignore parsing errors for incomplete chunks
                        }
                    }
                }
            });

            response.data.on('end', () => {
                // Include citations in content if available
                if (citations && citations.length > 0) {
                    const citationsText = '\n\n**Sources:**\n' + citations.map((url, index) => `${index + 1}. ${url}`).join('\n');

                    emitter.emit(TLLMEvent.Content, citationsText, 'assistant');
                }

                if (toolsData.length > 0) {
                    emitter.emit(TLLMEvent.ToolInfo, toolsData);
                }

                // Report usage if available
                if (Object.keys(usage).length > 0) {
                    const _reported = this.reportUsage(usage, {
                        modelEntryName: context.modelEntryName,
                        keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                        agentId: context.agentId,
                        teamId: context.teamId,
                    });
                    reportedUsage.push(_reported);
                }

                if (finishReason !== TLLMFinishReason.Stop) {
                    emitter.emit(TLLMEvent.Interrupted, finishReason);
                }

                setTimeout(() => {
                    emitter.emit(TLLMEvent.End, toolsData, reportedUsage, finishReason);
                }, 100);
            });

            response.data.on('error', (error) => {
                emitter.emit(TLLMEvent.Error, error);
            });
        } catch (error) {
            logger.error(`streamRequest ${this.name}`, error, acRequest.candidate);
            emitter.emit(TLLMEvent.Error, error);
        }

        return emitter;
    }

    protected async reqBodyAdapter(params: TLLMParams): Promise<ChatCompletionParams> {
        const messages = params?.messages || [];
        const modelName = params.model as string;

        // Handle JSON response format
        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            if (messages?.[0]?.role === TLLMMessageRole.System) {
                messages[0].content += JSON_RESPONSE_INSTRUCTION;
            } else {
                messages.unshift({ role: TLLMMessageRole.System, content: JSON_RESPONSE_INSTRUCTION });
            }

            params.responseFormat = { type: 'json_object' };
        }

        const body: ChatCompletionParams = {
            model: modelName,
            messages,
        };

        // Add parameters if they're not undefined and not 0 (for reasoning models)
        if (params?.maxTokens !== undefined) body.max_tokens = params.maxTokens;
        if (params?.temperature !== undefined) body.temperature = params.temperature;
        if (params?.topP !== undefined) body.top_p = params.topP;

        if (params?.responseFormat) {
            body.response_format = params.responseFormat;
        }

        // Add tools configuration if available
        if (params?.toolsConfig?.tools && params?.toolsConfig?.tools?.length > 0) {
            body.tools = params.toolsConfig.tools;
        }

        if (params?.toolsConfig?.tool_choice) {
            body.tool_choice = params.toolsConfig.tool_choice;
        }

        // Add xAI search configuration if useSearch is enabled
        if (params?.useSearch) {
            body.search_parameters = {};

            // Basic search parameters
            if (params.searchMode) body.search_parameters.mode = params.searchMode;
            if (params.returnCitations !== undefined) body.search_parameters.return_citations = params.returnCitations;
            if (params.maxSearchResults !== undefined) body.search_parameters.max_search_results = params.maxSearchResults;

            // Date filtering
            if (params.fromDate) body.search_parameters.from_date = params.fromDate;
            if (params.toDate) body.search_parameters.to_date = params.toDate;

            // Create sources array
            const sources: any[] = [];

            // If searchDataSources is provided, use it as source types
            if (params.searchDataSources && params.searchDataSources.length > 0) {
                params.searchDataSources.forEach((sourceType) => {
                    const source: any = { type: sourceType };

                    // Add parameters based on source type
                    if (sourceType === 'web' || sourceType === 'news') {
                        if (params.searchCountry) source.country = params.searchCountry;

                        // Website filtering (mutually exclusive)
                        if (params.excludedWebsites && params.excludedWebsites.length > 0) {
                            source.excluded_websites = params.excludedWebsites;
                        } else if (params.allowedWebsites && params.allowedWebsites.length > 0) {
                            source.allowed_websites = params.allowedWebsites;
                        }

                        if (params.safeSearch !== undefined) source.safe_search = params.safeSearch;
                    }

                    if (sourceType === 'x') {
                        if (params.includedXHandles && params.includedXHandles.length > 0) {
                            source.included_x_handles = params.includedXHandles;
                        } else if (params.excludedXHandles && params.excludedXHandles.length > 0) {
                            source.excluded_x_handles = params.excludedXHandles;
                        }
                        if (params.postFavoriteCount !== undefined && params.postFavoriteCount > 0) {
                            source.post_favorite_count = params.postFavoriteCount;
                        }
                        if (params.postViewCount !== undefined && params.postViewCount > 0) {
                            source.post_view_count = params.postViewCount;
                        }
                    }

                    if (sourceType === 'rss') {
                        if (params.rssLinks) source.links = params.rssLinks;
                    }

                    sources.push(source);
                });
            }

            if (sources.length > 0) {
                body.search_parameters.sources = sources;
            }
        }

        return body;
    }

    protected reportUsage(usage: TUsage, metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }) {
        // SmythOS (built-in) models have a prefix, so we need to remove it to get the model name
        const modelName = metadata.modelEntryName.replace(BUILT_IN_MODEL_PREFIX, '');

        const usageData = {
            sourceId: `llm:${modelName}`,
            input_tokens: usage?.prompt_tokens - (usage?.prompt_tokens_details?.cached_tokens || 0),
            output_tokens: usage?.completion_tokens,
            input_tokens_cache_write: 0,
            input_tokens_cache_read: usage?.prompt_tokens_details?.cached_tokens || 0,
            reasoning_tokens: usage?.completion_tokens_details?.reasoning_tokens || usage?.reasoning_tokens || 0,
            keySource: metadata.keySource,
            agentId: metadata.agentId,
            teamId: metadata.teamId,
        };
        SystemEvents.emit('USAGE:LLM', usageData);

        return usageData;
    }

    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto' }) {
        let tools: any[] = [];

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
                for (let toolCall of transformedMessageBlock.tool_calls) {
                    toolCall.function.arguments =
                        typeof toolCall.function.arguments === 'object' ? JSON.stringify(toolCall.function.arguments) : toolCall.function.arguments;
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

    public getConsistentMessages(messages) {
        // Normalize the message flow to remove malformed sequences
        // (consecutive user messages, errored tool calls, etc.)
        const _messages = LLMHelper.normalizeMessages(messages);

        return _messages.map((message) => {
            const _message = { ...message };
            let textContent = '';

            if (message?.parts) {
                textContent = message.parts.map((textBlock) => textBlock?.text || '').join(' ');
            } else if (Array.isArray(message?.content)) {
                textContent = message.content.map((textBlock) => textBlock?.text || '').join(' ');
            } else if (message?.content) {
                textContent = message.content;
            }

            _message.content = textContent;

            return _message;
        });
    }
}
