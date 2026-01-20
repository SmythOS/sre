import EventEmitter from 'events';
import axios, { AxiosInstance } from 'axios';

import { JSON_RESPONSE_INSTRUCTION, BUILT_IN_MODEL_PREFIX } from '@sre/constants';

import {
    ToolData,
    TLLMMessageBlock,
    TLLMToolResultMessageBlock,
    TLLMMessageRole,
    APIKeySource,
    BasicCredentials,
    ILLMRequestFuncParams,
    TLLMChatResponse,
    ILLMRequestContext,
    TLLMPreparedParams,
    TLLMEvent,
    TLLMFinishReason,
} from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';

import { LLMConnector } from '../LLMConnector';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { Logger } from '@sre/helpers/Log.helper';
import { hookAsync } from '@sre/Core/HookService';

const logger = Logger('PerplexityConnector');

type ChatCompletionParams = {
    model: string;
    messages: any[];
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    response_format?: { type: string };
};
type TUsage = {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: { cached_tokens?: number };
    reasoning_tokens?: number;
};

// TODO [Forhad]: Need to adjust some type definitions

export class PerplexityConnector extends LLMConnector {
    public name = 'LLM:Perplexity';

    private async getClient(params: ILLMRequestContext): Promise<AxiosInstance> {
        const apiKey = (params.credentials as BasicCredentials)?.apiKey;

        if (!apiKey) throw new Error('Please provide an API key for Perplexity');

        return axios.create({
            baseURL: params?.modelInfo?.baseURL,
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        });
    }

    @hookAsync('LLMConnector.request')
    protected async request({ acRequest, body, context, abortSignal }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        try {
            logger.debug(`request ${this.name}`, acRequest.candidate);
            const perplexity = await this.getClient(context);
            const response = await perplexity.post('/chat/completions', body, { signal: abortSignal });

            const content = response?.data?.choices?.[0]?.message.content;
            const finishReason = response?.data?.choices?.[0]?.finish_reason;
            const usage = response?.data?.usage as any;

            this.reportUsage(usage, {
                modelEntryName: context.modelEntryName,
                keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId: context.agentId,
                teamId: context.teamId,
            });

            return {
                content,
                finishReason,
                useTool: false,
                toolsData: [],
                message: { content, role: 'assistant' },
                usage,
            };
        } catch (error) {
            logger.error(`request ${this.name}`, error, acRequest.candidate);
            throw error;
        }
    }

    @hookAsync('LLMConnector.streamRequest')
    protected async streamRequest({ acRequest, body, context, abortSignal }: ILLMRequestFuncParams): Promise<EventEmitter> {
        //throw new Error('Multimodal request is not supported for Perplexity.');
        //fallback to chatRequest
        const emitter = new EventEmitter();

        // TODO: need to implement proper streaming for Perplexity

        setTimeout(() => {
            try {
                logger.debug(`streamRequest ${this.name}`, acRequest.candidate);
                this.request({ acRequest, body, context, abortSignal })
                    .then((respose) => {
                        const finishReason = respose.finishReason;
                        const usage = respose.usage;

                        emitter.emit(TLLMEvent.Data, respose);
                        emitter.emit(TLLMEvent.Content, respose.content);

                        // Only emit Interrupted if finishReason is not 'stop'
                        if (finishReason !== TLLMFinishReason.Stop) {
                            emitter.emit(TLLMEvent.Interrupted, finishReason);
                        }

                        emitter.emit(TLLMEvent.End, [], [usage], finishReason);
                    })
                    .catch((error) => {
                        emitter.emit(TLLMEvent.Error, error.message || error.toString());
                    });
                //emitter.emit('finishReason', respose.finishReason);
            } catch (error) {
                logger.error(`streamRequest ${this.name}`, error, acRequest.candidate);
                emitter.emit(TLLMEvent.Error, error.message || error.toString());
            }
        }, 100);

        return emitter;
    }

    protected async reqBodyAdapter(params: TLLMPreparedParams): Promise<ChatCompletionParams> {
        const messages = params?.messages || [];

        //#region Handle JSON response format
        // TODO: For now attach JSON response instruction, Perplexity has option to provide response_format as parameter. We'll check it later
        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            // We assume that the system message is first item in messages array
            if (messages?.[0]?.role === TLLMMessageRole.System) {
                messages[0].content += JSON_RESPONSE_INSTRUCTION;
            } else {
                messages.unshift({ role: TLLMMessageRole.System, content: JSON_RESPONSE_INSTRUCTION });
            }

            delete params.responseFormat;
        }
        //#endregion Handle JSON response format

        const body: ChatCompletionParams = {
            model: params.model as string,
            messages,
        };

        if (params?.maxTokens !== undefined) body.max_tokens = params.maxTokens;
        if (params?.temperature !== undefined) body.temperature = params.temperature;
        if (params?.topP !== undefined) body.top_p = params.topP;
        if (params?.topK !== undefined) body.top_k = params.topK;
        if (params?.frequencyPenalty) body.frequency_penalty = params.frequencyPenalty;
        if (params?.presencePenalty !== undefined) body.presence_penalty = params.presencePenalty;

        if (params.responseFormat) {
            body.response_format = params.responseFormat;
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
            reasoning_tokens: usage?.reasoning_tokens || 0,
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
            role: TLLMMessageRole.Tool, // toolData.role as TLLMMessageRole, //should always be 'tool' for OpenAI
            name: toolData.name,
            content: typeof toolData.result === 'string' ? toolData.result : JSON.stringify(toolData.result), // Ensure content is a string
        }));

        return [...messageBlocks, ...transformedToolsData];
    }

    public getConsistentMessages(messages) {
        const _messages = LLMHelper.removeDuplicateUserMessages(messages);

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
