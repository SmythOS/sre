import { VertexAI, type ModelParams, type GenerationConfig, type Content } from '@google-cloud/vertexai';
import EventEmitter from 'events';

import Agent from '@sre/AgentManager/Agent.class';
import { JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { TLLMParams, TLLMMessageBlock, TLLMMessageRole, TVertexAIModel } from '@sre/types/LLM.types';
import { VaultHelper } from '@sre/Security/Vault.service/Vault.helper';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';

import { ImagesResponse, LLMChatResponse, LLMConnector } from '../LLMConnector';

const console = Logger('VertexAIConnector');

export class VertexAIConnector extends LLMConnector {
    public name = 'LLM:VertexAI';

    protected async chatRequest(acRequest: AccessRequest, params: TLLMParams): Promise<LLMChatResponse> {
        const _params = { ...params };
        let messages = _params?.messages || [];

        //#region Separate system message and add JSON response instruction if needed
        let systemInstruction;
        const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(messages);

        if ('content' in systemMessage) {
            systemInstruction = systemMessage.content;
        }

        messages = otherMessages;

        const responseFormat = _params?.responseFormat || '';
        if (responseFormat === 'json') {
            systemInstruction = JSON_RESPONSE_INSTRUCTION;
        }
        //#endregion Separate system message and add JSON response instruction if needed

        const modelInfo = _params.modelInfo as TVertexAIModel;

        const generationConfig: GenerationConfig = {};
        if (_params?.maxTokens !== undefined) generationConfig.maxOutputTokens = _params.maxTokens;
        if (_params?.temperature !== undefined) generationConfig.temperature = _params.temperature;
        if (_params?.topP !== undefined) generationConfig.topP = _params.topP;
        if (_params?.topK !== undefined) generationConfig.topK = _params.topK;
        if (_params?.stopSequences?.length) generationConfig.stopSequences = _params.stopSequences;

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
                project: modelInfo.settings.projectId,
                location: modelInfo?.settings?.region,
                googleAuthOptions: {
                    credentials: _params.credentials as any, // TODO [Forhad]: apply proper typing
                },
                apiEndpoint: `${modelInfo?.settings?.region}-aiplatform.googleapis.com`,
            });
            const generativeModel = client.getGenerativeModel(modelParams);

            const result = await generativeModel.generateContent({ contents: messages });
            const content = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;

            return { content, finishReason: 'stop' };
        } catch (error) {
            throw error;
        }
    }

    protected async streamToolRequest(acRequest: AccessRequest, { model, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }): Promise<any> {
        throw new Error('streamToolRequest() is not supported by Vertex AI');
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Vision requests are not currently implemented for Vertex AI');
    }

    protected async multimodalRequest(acRequest: AccessRequest, prompt, params: any, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Multimodal request is not currently implemented for Vertex AI');
    }

    protected async toolRequest(acRequest: AccessRequest, params): Promise<any> {
        throw new Error('Tool requests are not currently implemented for Vertex AI');
    }

    protected async imageGenRequest(acRequest: AccessRequest, prompt, params: any, agent?: string | Agent): Promise<ImagesResponse> {
        throw new Error('Image generation request is not currently implemented for Vertex AI');
    }

    protected async streamRequest(acRequest: AccessRequest, params): Promise<EventEmitter> {
        throw new Error('Streaming is not currently implemented for Vertex AI');
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
