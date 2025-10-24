import { Ollama, ChatResponse, type ChatRequest } from 'ollama';
import EventEmitter from 'events';

import { JSON_RESPONSE_INSTRUCTION, BUILT_IN_MODEL_PREFIX } from '@sre/constants';
import {
    TLLMMessageBlock,
    ToolData,
    TLLMMessageRole,
    APIKeySource,
    TLLMEvent,
    ILLMRequestFuncParams,
    TLLMChatResponse,
    ILLMRequestContext,
    TLLMPreparedParams,
    TLLMToolResultMessageBlock,
    TLLMRequestBody,
    BasicCredentials,
} from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';

import { LLMConnector } from '../LLMConnector';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { Logger } from '@sre/helpers/Log.helper';

const logger = Logger('OllamaConnector');

type OllamaChatRequest = {
    model: string;
    messages: any[];
    stream?: boolean;
    options?: {
        num_predict?: number;
        temperature?: number;
        top_p?: number;
        top_k?: number;
        stop?: string[];
    };
    tools?: any[];
};

export class OllamaConnector extends LLMConnector {
    public name = 'LLM:Ollama';

    private getClient(context: ILLMRequestContext): Ollama {
        // Extract baseURL and sanitize it for Ollama SDK
        let host = 'http://localhost:11434';

        const apiKey = (context.credentials as BasicCredentials)?.apiKey;
        const baseURL = context?.modelInfo?.baseURL;

        if (baseURL) {
            // Extract base URL (origin) using URL class
            const url = new URL(baseURL);
            host = url.origin;
        }

        const config: { host: string; headers?: { Authorization?: string } } = { host };

        if (apiKey) {
            config.headers = {
                Authorization: `Bearer ${apiKey}`,
            };
        }

        // No API key validation required for Ollama (local by default)
        return new Ollama(config);
    }

    protected async request({ acRequest, body, context }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        try {
            logger.debug(`request ${this.name}`, acRequest.candidate);
            const ollama = this.getClient(context);

            const result = (await ollama.chat({
                ...body,
                stream: false,
            })) as unknown as ChatResponse;

            const message = result.message;
            const finishReason = result.done_reason || 'stop';
            const usage = {
                prompt_tokens: result.prompt_eval_count || 0,
                completion_tokens: result.eval_count || 0,
                total_tokens: (result.prompt_eval_count || 0) + (result.eval_count || 0),
            };

            this.reportUsage(usage, {
                modelEntryName: context.modelEntryName,
                keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId: context.agentId,
                teamId: context.teamId,
            });

            let toolsData: ToolData[] = [];
            let useTool = false;

            // Handle tool calls if present
            if (message?.tool_calls) {
                toolsData = message.tool_calls.map((tool, index) => ({
                    index,
                    id: tool.function?.name || `tool_${index}`,
                    type: 'function',
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
                message: message as any,
                usage,
            };
        } catch (error) {
            logger.error(`request ${this.name}`, error, acRequest.candidate);
            throw error;
        }
    }

    protected async streamRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        try {
            logger.debug(`streamRequest ${this.name}`, acRequest.candidate);
            const emitter = new EventEmitter();
            const usage_data = [];

            const ollama = this.getClient(context);
            const stream = (await ollama.chat({
                ...body,
                stream: true,
            })) as AsyncIterable<ChatResponse>;

            let toolsData: ToolData[] = [];
            let fullContent = '';

            (async () => {
                for await (const chunk of stream) {
                    // Emit content deltas
                    if (chunk.message?.content) {
                        const content = chunk.message.content;
                        fullContent += content;
                        emitter.emit('content', content);
                    }

                    // Handle tool calls accumulation
                    if (chunk.message?.tool_calls) {
                        chunk.message.tool_calls.forEach((toolCall, index) => {
                            if (!toolsData[index]) {
                                toolsData[index] = {
                                    index,
                                    id: toolCall.function?.name || `tool_${index}`,
                                    type: 'function',
                                    name: toolCall.function?.name,
                                    arguments: toolCall.function?.arguments || '',
                                    role: 'assistant',
                                };
                            } else {
                                // Merge arguments across chunks for string arguments
                                if (typeof toolsData[index].arguments === 'string' && typeof toolCall.function?.arguments === 'string') {
                                    toolsData[index].arguments += toolCall.function.arguments;
                                } else {
                                    // For object arguments, merge them properly
                                    toolsData[index].arguments = { ...(toolsData[index].arguments as any), ...toolCall.function?.arguments };
                                }
                            }
                        });
                    }

                    // Capture usage data when available
                    if (chunk.prompt_eval_count !== undefined || chunk.eval_count !== undefined) {
                        const usage = {
                            prompt_tokens: chunk.prompt_eval_count || 0,
                            completion_tokens: chunk.eval_count || 0,
                            total_tokens: (chunk.prompt_eval_count || 0) + (chunk.eval_count || 0),
                        };
                        usage_data.push(usage);
                    }
                }

                // Emit tool info if tools were requested
                if (toolsData.length > 0) {
                    emitter.emit(TLLMEvent.ToolInfo, toolsData);
                }

                // Report usage
                usage_data.forEach((usage) => {
                    this.reportUsage(usage, {
                        modelEntryName: context.modelEntryName,
                        keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                        agentId: context.agentId,
                        teamId: context.teamId,
                    });
                });

                // Final end event
                setTimeout(() => {
                    emitter.emit('end', toolsData);
                }, 100);
            })();

            return emitter;
        } catch (error: any) {
            logger.error(`streamRequest ${this.name}`, error, acRequest.candidate);
            throw error;
        }
    }

    protected async reqBodyAdapter(params: TLLMPreparedParams): Promise<TLLMRequestBody> {
        const messages = params?.messages || [];

        const body: OllamaChatRequest = {
            model: params.model as string,
            messages,
        };

        // Handle JSON response format
        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            if (messages?.[0]?.role === 'system') {
                messages[0].content += JSON_RESPONSE_INSTRUCTION;
            } else {
                messages.unshift({ role: 'system', content: JSON_RESPONSE_INSTRUCTION });
            }
        }

        // Map SRE options to Ollama options
        const options: any = {};

        if (params.maxTokens !== undefined) options.num_predict = params.maxTokens;
        if (params.temperature !== undefined) options.temperature = params.temperature;
        if (params.topP !== undefined) options.top_p = params.topP;
        if (params.topK !== undefined) options.top_k = params.topK;
        if (params.stopSequences?.length) options.stop = params.stopSequences;

        if (Object.keys(options).length > 0) {
            body.options = options;
        }

        // Handle tools
        if (params.toolsConfig?.tools) {
            body.tools = params.toolsConfig.tools.map((tool) => ({
                type: 'function',
                function: {
                    name: tool.function.name,
                    description: tool.function.description,
                    parameters: tool.function.parameters,
                },
            }));
        }

        return body as unknown as TLLMRequestBody;
    }

    protected reportUsage(
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
        metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }
    ) {
        // SmythOS (built-in) models have a prefix, so we need to remove it to get the model name
        const modelName = metadata.modelEntryName.replace(BUILT_IN_MODEL_PREFIX, '');

        const usageData = {
            sourceId: `llm:${modelName}`,
            input_tokens: usage.prompt_tokens,
            output_tokens: usage.completion_tokens,
            input_tokens_cache_write: 0,
            input_tokens_cache_read: 0,
            keySource: metadata.keySource,
            agentId: metadata.agentId,
            teamId: metadata.teamId,
        };
        SystemEvents.emit('USAGE:LLM', usageData);

        return usageData;
    }

    public transformToolMessageBlocks({
        messageBlock,
        toolsData,
    }: {
        messageBlock: TLLMMessageBlock;
        toolsData: ToolData[];
    }): TLLMToolResultMessageBlock[] {
        const messageBlocks: TLLMToolResultMessageBlock[] = [];

        // Transform the assistant message block if present
        if (messageBlock) {
            const transformedMessageBlock = {
                ...messageBlock,
                content: typeof messageBlock.content === 'object' ? JSON.stringify(messageBlock.content) : messageBlock.content,
            };
            if (transformedMessageBlock.tool_calls) {
                for (let toolCall of transformedMessageBlock.tool_calls) {
                    const args = toolCall?.function?.arguments;
                    if (typeof args === 'string') {
                        try {
                            toolCall.function.arguments = JSON.parse(args);
                        } catch {
                            toolCall.function.arguments = {};
                        }
                    }
                    // If it's already an object, keep as-is for Ollama
                }
            }
            messageBlocks.push(transformedMessageBlock);
        }

        // Transform tool results into tool role messages
        const transformedToolsData = toolsData.map((toolData) => ({
            tool_call_id: toolData.id,
            role: TLLMMessageRole.Tool,
            name: toolData.name,
            content: typeof toolData.result === 'string' ? toolData.result : JSON.stringify(toolData.result),
        }));

        return [...messageBlocks, ...transformedToolsData];
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
