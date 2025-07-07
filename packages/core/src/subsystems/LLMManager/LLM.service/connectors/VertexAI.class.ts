import EventEmitter from 'events';

import { JSON_RESPONSE_INSTRUCTION, BUILT_IN_MODEL_PREFIX } from '@sre/constants';
import {
    TLLMParams,
    TCustomLLMModel,
    APIKeySource,
    TVertexAISettings,
    ILLMRequestFuncParams,
    TGoogleAIRequestBody,
    TLLMConnectorParams,
    ILLMRequestContext,
} from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';

import { LLMConnector } from '../LLMConnector';
import { SystemEvents } from '@sre/Core/SystemEvents';

//import { VertexAI, type GenerationConfig, type UsageMetadata } from '@google-cloud/vertexai';

import { LazyLoadFallback } from '@sre/utils/lazy-client';
import type * as VertexAITypes from '@google-cloud/vertexai';

let VertexAIModule: typeof VertexAITypes | undefined;
//#IFDEF STATIC VERTEXAI_STATIC
import * as _VertexAIModule from '@google-cloud/vertexai';
VertexAIModule = _VertexAIModule;
//#ENDIF

//TODO: [AHMED/FORHAD]: test the usage reporting for VertexAI because by the time we were implementing the feature of usage reporting
// we had no access to VertexAI so we assumed it is working (potential bug)

export class VertexAIConnector extends LLMConnector {
    public name = 'LLM:VertexAI';

    private async getClient(params: ILLMRequestContext): Promise<VertexAITypes.VertexAI> {
        const { VertexAI } = await LazyLoadFallback<typeof VertexAIModule>(VertexAIModule, '@google-cloud/vertexai');
        const credentials = params.credentials as any;
        const modelInfo = params.modelInfo as TCustomLLMModel;
        const projectId = (modelInfo?.settings as TVertexAISettings)?.projectId;
        const region = modelInfo?.settings?.region;

        return new VertexAI({
            project: projectId,
            location: region,
            googleAuthOptions: {
                credentials: credentials as any,
            },
        });
    }

    protected async request({ acRequest, body, context }: ILLMRequestFuncParams): Promise<any> {
        const messages = body.messages;
        delete body.messages;

        try {
            const vertexAI = await this.getClient(context);
            const generativeModel = vertexAI.getGenerativeModel(body);

            const result = await generativeModel.generateContent({ contents: messages });
            const content = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
            const usage = result?.response?.usageMetadata;

            this.reportUsage(usage, {
                modelEntryName: context.modelEntryName,
                keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId: context.agentId,
                teamId: context.teamId,
            });

            return {
                content,
                finishReason: 'stop',
                useTool: false,
                toolsData: [],
                message: { content, role: 'assistant' },
                usage,
            };
        } catch (error) {
            throw error;
        }
    }

    protected async streamRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        // Simulate streaming similar to Perplexity's approach - fallback to regular request
        const emitter = new EventEmitter();

        setTimeout(() => {
            try {
                this.request({ acRequest, body, context })
                    .then((response) => {
                        const finishReason = response.finishReason;
                        const usage = response.usage;

                        // Emit the content as a stream-like response
                        emitter.emit('interrupted', finishReason);
                        emitter.emit('content', response.content);
                        emitter.emit('end', undefined, usage, finishReason);
                    })
                    .catch((error) => {
                        emitter.emit('error', error.message || error.toString());
                    });
            } catch (error) {
                emitter.emit('error', error.message || error.toString());
            }
        }, 100);

        return emitter;
    }

    protected async webSearchRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        throw new Error('Web search is not supported for Vertex AI');
    }

    protected async reqBodyAdapter(params: TLLMParams): Promise<TGoogleAIRequestBody> {
        let messages = params?.messages || [];

        //#region Separate system message and add JSON response instruction if needed
        let systemInstruction;
        const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(messages);

        if ('content' in systemMessage) {
            systemInstruction = systemMessage.content;
        }

        messages = otherMessages;

        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            systemInstruction = JSON_RESPONSE_INSTRUCTION;
        }
        //#endregion Separate system message and add JSON response instruction if needed

        const modelInfo = params.modelInfo as TCustomLLMModel;

        let body: TGoogleAIRequestBody = {
            model: modelInfo?.settings?.customModel || modelInfo?.settings?.foundationModel,
            messages,
        };

        const config: VertexAITypes.GenerationConfig = {};

        if (params?.maxTokens !== undefined) config.maxOutputTokens = params.maxTokens;
        if (params?.temperature !== undefined) config.temperature = params.temperature;
        if (params?.topP !== undefined) config.topP = params.topP;
        if (params?.topK !== undefined) config.topK = params.topK;
        if (params?.stopSequences?.length) config.stopSequences = params.stopSequences;

        if (systemInstruction) {
            body.systemInstruction = systemInstruction;
        }

        if (Object.keys(config).length > 0) {
            body.generationConfig = config as any;
        }

        return body;
    }

    protected reportUsage(
        usage: VertexAITypes.UsageMetadata & { cachedContentTokenCount?: number },
        metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }
    ) {
        // SmythOS (built-in) models have a prefix, so we need to remove it to get the model name
        const modelName = metadata.modelEntryName.replace(BUILT_IN_MODEL_PREFIX, '');

        const usageData = {
            sourceId: `llm:${modelName}`,
            input_tokens: usage.promptTokenCount || 0,
            output_tokens: usage.candidatesTokenCount || 0,
            input_tokens_cache_read: usage.cachedContentTokenCount || 0,
            input_tokens_cache_write: 0,
            keySource: metadata.keySource,
            agentId: metadata.agentId,
            teamId: metadata.teamId,
        };
        SystemEvents.emit('USAGE:LLM', usageData);

        return usageData;
    }

    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto' }) {
        throw new Error('Tool configuration is not currently implemented for Vertex AI');
    }

    public getConsistentMessages(messages) {
        const _messages = LLMHelper.removeDuplicateUserMessages(messages);

        return _messages.map((message) => {
            let textBlock = [];

            if (message?.parts) {
                textBlock = message.parts;
            } else if (message?.content) {
                textBlock = Array.isArray(message.content) ? message.content : [{ text: message.content as string }];
            }

            return {
                role: message.role,
                parts: textBlock,
            };
        });
    }
}
