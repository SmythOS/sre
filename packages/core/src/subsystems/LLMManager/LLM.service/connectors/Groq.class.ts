import Groq from 'groq-sdk';
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
} from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';

import { LLMConnector } from '../LLMConnector';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { Logger } from '@sre/helpers/Log.helper';
import { hookAsync } from '@sre/Core/HookService';

const logger = Logger('GroqConnector');

type ChatCompletionCreateParams = {
    model: string;
    messages: any;
    max_completion_tokens?: number;
    max_tokens?: number;
    temperature?: number;
    stop?: string[];
    top_p?: number;
    tools?: any;
    tool_choice?: string;
    stream?: boolean;
    reasoning_effort?: 'none' | 'default' | 'low' | 'medium' | 'high';
};

const MODELS_WITHOUT_REASONING_EFFORT_SUPPORT = ['deepseek-r1-distill-llama-70b'];

export class GroqConnector extends LLMConnector {
    public name = 'LLM:Groq';

    private async getClient(params: ILLMRequestContext): Promise<Groq> {
        const apiKey = (params.credentials as BasicCredentials)?.apiKey;

        if (!apiKey) throw new Error('Please provide an API key for Groq');

        return new Groq({ apiKey });
    }

    @hookAsync('LLMConnector.request')
    protected async request({ acRequest, body, context }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        try {
            logger.debug(`request ${this.name}`, acRequest.candidate);
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
        } catch (error) {
            logger.error(`request ${this.name}`, error, acRequest.candidate);
            throw error;
        }
    }

    @hookAsync('LLMConnector.streamRequest')
    protected async streamRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        try {
            logger.debug(`streamRequest ${this.name}`, acRequest.candidate);
            const emitter = new EventEmitter();
            const usage_data = [];

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
            logger.error(`streamRequest ${this.name}`, error, acRequest.candidate);
            throw error;
        }
    }

    protected async reqBodyAdapter(params: TLLMPreparedParams): Promise<ChatCompletionCreateParams> {
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

        const allowReasoning = params.useReasoning && params.capabilities?.reasoning;

        if (params.maxTokens !== undefined) {
            if (allowReasoning) {
                body.max_completion_tokens = params.maxTokens;
            } else {
                body.max_tokens = params.maxTokens;
            }
        }
        if (params.temperature !== undefined) body.temperature = params.temperature;
        if (params.topP !== undefined) body.top_p = params.topP;
        if (params.stopSequences?.length) body.stop = params.stopSequences;

        if (params.toolsConfig?.tools) body.tools = params.toolsConfig?.tools;
        if (params.toolsConfig?.tool_choice) body.tool_choice = params.toolsConfig?.tool_choice as any;

        // Apply user-specified reasoning parameters
        if (
            allowReasoning &&
            isValidGroqReasoningEffort(params?.reasoningEffort) &&
            !MODELS_WITHOUT_REASONING_EFFORT_SUPPORT.includes(params?.modelEntryName)
        ) {
            if (params.reasoningEffort !== undefined) body.reasoning_effort = params.reasoningEffort;
        }

        return body;
    }

    protected reportUsage(
        usage: Groq.Completions.CompletionUsage & { prompt_tokens_details?: { cached_tokens?: number } },
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
            role: TLLMMessageRole.Tool, // toolData.role as TLLMMessageRole, //should always be 'tool' for OpenAI
            name: toolData.name,
            content: typeof toolData.result === 'string' ? toolData.result : JSON.stringify(toolData.result), // Ensure content is a string
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
/**
 * Type guard to check if a value is a valid OpenAI reasoning effort.
 * Uses array includes for better maintainability when OpenAI adds new values.
 */
export function isValidGroqReasoningEffort(value: unknown): value is 'low' | 'medium' | 'high' | 'none' | 'default' {
    return ['none', 'default', 'low', 'medium', 'high'].includes(value as string);
}
