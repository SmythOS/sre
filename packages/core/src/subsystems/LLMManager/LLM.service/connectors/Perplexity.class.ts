import EventEmitter from 'events';

import axios from 'axios';

import { IAgent } from '@sre/types/Agent.types';
import { isAgent } from '@sre/AgentManager/Agent.helper';
import { JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import {
    TLLMParams,
    ToolData,
    TLLMMessageBlock,
    TLLMToolResultMessageBlock,
    TLLMMessageRole,
    GenerateImageConfig,
    APIKeySource,
} from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';

import { ImagesResponse, LLMChatResponse, LLMConnector } from '../LLMConnector';
import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { SystemEvents } from '@sre/Core/SystemEvents';

const console = Logger('PerplexityConnector');

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

    protected async chatRequest(acRequest: AccessRequest, params: TLLMParams, agent: string | IAgent): Promise<LLMChatResponse> {
        const messages = params?.messages || [];

        const agentId = isAgent(agent) ? (agent as IAgent).id : agent;

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

        // Check if the team has their own API key, then use it
        const apiKey = params?.credentials?.apiKey;

        if (!apiKey) {
            throw new Error('An API key is required to use this model.');
        }

        const chatCompletionArgs: ChatCompletionParams = {
            model: params.model,
            messages,
        };

        if (params?.maxTokens !== undefined) chatCompletionArgs.max_tokens = params.maxTokens;
        if (params?.temperature !== undefined) chatCompletionArgs.temperature = params.temperature;
        // Top P is not supported for o1 models
        if (params?.topP !== undefined) chatCompletionArgs.top_p = params.topP;
        if (params?.topK !== undefined) chatCompletionArgs.top_k = params.topK;
        if (params?.frequencyPenalty) chatCompletionArgs.frequency_penalty = params.frequencyPenalty;
        if (params?.presencePenalty !== undefined) chatCompletionArgs.presence_penalty = params.presencePenalty;

        if (params.responseFormat) {
            chatCompletionArgs.response_format = params.responseFormat;
        }

        try {
            const response = await axios.post(params.baseURL, chatCompletionArgs, {
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            });

            const content = response?.data?.choices?.[0]?.message.content;
            const finishReason = response?.data?.choices?.[0]?.finish_reason;
            const usage = response?.data?.usage as any;

            this.reportUsage(usage, {
                modelEntryName: params.modelEntryName,
                keySource: params.credentials.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId,
                teamId: params.teamId,
            });

            return { content, finishReason, usage };
        } catch (error) {
            throw error;
        }
    }

    protected async streamToolRequest(
        acRequest: AccessRequest,
        { model, messages, toolsConfig: { tools, tool_choice }, apiKey = '' },
        agent: string | IAgent,
    ): Promise<any> {
        throw new Error('streamToolRequest() is Deprecated!');
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent: string | IAgent): Promise<LLMChatResponse> {
        throw new Error('Vision requests are not supported by Perplexity');
    }

    protected async multimodalRequest(acRequest: AccessRequest, prompt, params: any, agent: string | IAgent): Promise<LLMChatResponse> {
        throw new Error('Multimodal request is not supported for Perplexity.');
    }

    protected async toolRequest(acRequest: AccessRequest, params, agent: string | IAgent): Promise<any> {
        throw new Error('Tool request is not supported for Perplexity.');
    }

    protected async imageGenRequest(acRequest: AccessRequest, prompt, params: any, agent: string | IAgent): Promise<ImagesResponse> {
        throw new Error('Image generation request is not supported for Perplexity.');
    }

    protected async streamRequest(acRequest: AccessRequest, params, agent: string | IAgent): Promise<EventEmitter> {
        //throw new Error('Multimodal request is not supported for Perplexity.');
        //fallback to chatRequest
        const emitter = new EventEmitter();

        setTimeout(() => {
            try {
                this.chatRequest(acRequest, params, agent)
                    .then((respose) => {
                        const finishReason = respose.finishReason;
                        const usage = respose.usage;

                        emitter.emit('interrupted', finishReason);
                        emitter.emit('content', respose.content);
                        emitter.emit('end', undefined, usage, finishReason);
                    })
                    .catch((error) => {
                        emitter.emit('error', error.message || error.toString());
                    });
                //emitter.emit('finishReason', respose.finishReason);
            } catch (error) {
                emitter.emit('error', error.message || error.toString());
            }
        }, 100);

        return emitter;
    }

    protected async multimodalStreamRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent: string | IAgent): Promise<EventEmitter> {
        throw new Error('Perplexity model does not support passthrough with File(s)');
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

    protected reportUsage(usage: TUsage, metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }) {
        let modelName = metadata.modelEntryName;
        // SmythOS models have a prefix, so we need to remove it to get the model name
        if (metadata.modelEntryName.startsWith('smythos/')) {
            modelName = metadata.modelEntryName.split('/').pop();
        }

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
}
