import { VertexAI, type ModelParams, type GenerationConfig, type Content, UsageMetadata } from '@google-cloud/vertexai';
import EventEmitter from 'events';

import { Agent } from '@sre/AgentManager/Agent.class';
import { JSON_RESPONSE_INSTRUCTION, BUILT_IN_MODEL_PREFIX } from '@sre/constants';
import { IAgent } from '@sre/types/Agent.types';
import { isAgent } from '@sre/AgentManager/Agent.helper';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { TLLMParams, TCustomLLMModel, APIKeySource, TVertexAISettings } from '@sre/types/LLM.types';
import { VaultHelper } from '@sre/Security/Vault.service/Vault.helper';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';

import { LLMChatResponse, LLMConnector } from '../LLMConnector';
import { SystemEvents } from '@sre/Core/SystemEvents';

const console = Logger('VertexAIConnector');

//TODO: [AHMED/FORHAD]: test the usage reporting for VertexAI because by the time we were implementing the feature of usage reporting
// we had no access to VertexAI so we assumed it is working (potential bug)

export class VertexAIConnector extends LLMConnector {
    public name = 'LLM:VertexAI';

    protected async chatRequest(acRequest: AccessRequest, params: TLLMParams, agent: string | IAgent): Promise<LLMChatResponse> {
        let messages = params?.messages || [];

        const agentId = isAgent(agent) ? (agent as IAgent).id : agent;

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

        const generationConfig: GenerationConfig = {};
        if (params?.maxTokens !== undefined) generationConfig.maxOutputTokens = params.maxTokens;
        if (params?.temperature !== undefined) generationConfig.temperature = params.temperature;
        if (params?.topP !== undefined) generationConfig.topP = params.topP;
        if (params?.topK !== undefined) generationConfig.topK = params.topK;
        if (params?.stopSequences?.length) generationConfig.stopSequences = params.stopSequences;

        const modelParams: ModelParams = {
            model: modelInfo?.settings?.customModel || modelInfo?.settings?.foundationModel,
        };

        if (systemInstruction) {
            modelParams.systemInstruction = systemInstruction;
        }

        if (Object.keys(generationConfig).length > 0) {
            modelParams.generationConfig = generationConfig;
        }

        try {
            const client = new VertexAI({
                project: (modelInfo.settings as TVertexAISettings).projectId,
                location: modelInfo?.settings?.region,
                googleAuthOptions: {
                    credentials: params.credentials as any, // TODO [Forhad]: apply proper typing
                },
                apiEndpoint: `${modelInfo?.settings?.region}-aiplatform.googleapis.com`,
            });
            const generativeModel = client.getGenerativeModel(modelParams);

            const result = await generativeModel.generateContent({ contents: messages });
            const content = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
            const usage = result?.response?.usageMetadata;
            this.reportUsage(usage, {
                modelEntryName: params.modelEntryName,
                keySource: params.credentials.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId,
                teamId: params.teamId,
            });

            return { content, finishReason: 'stop' };
        } catch (error) {
            throw error;
        }
    }

    protected async streamToolRequest(
        acRequest: AccessRequest,
        { model, messages, toolsConfig: { tools, tool_choice }, apiKey = '' },
        agent: string | IAgent,
    ): Promise<any> {
        throw new Error('streamToolRequest() is not supported by Vertex AI');
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent: string | IAgent): Promise<LLMChatResponse> {
        throw new Error('Vision requests are not currently implemented for Vertex AI');
    }

    protected async multimodalRequest(acRequest: AccessRequest, prompt, params: any, agent: string | IAgent): Promise<LLMChatResponse> {
        throw new Error('Multimodal request is not currently implemented for Vertex AI');
    }

    protected async toolRequest(acRequest: AccessRequest, params): Promise<any> {
        throw new Error('Tool requests are not currently implemented for Vertex AI');
    }

    protected async imageGenRequest(acRequest: AccessRequest, prompt, params: any, agent: string | IAgent): Promise<any> {
        throw new Error('Image generation request is not currently implemented for Vertex AI');
    }

    protected async streamRequest(acRequest: AccessRequest, params, agent: string | IAgent): Promise<EventEmitter> {
        throw new Error('Streaming is not currently implemented for Vertex AI');
    }

    protected async multimodalStreamRequest(acRequest: AccessRequest, prompt, params: TLLMParams, agent: string | IAgent): Promise<EventEmitter> {
        throw new Error('VertexAI model does not support passthrough with File(s)');
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

    protected reportUsage(
        usage: UsageMetadata & { cachedContentTokenCount?: number },
        metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string },
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
}
