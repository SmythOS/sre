import { VertexAI, type ModelParams, type GenerationConfig, type Content } from '@google-cloud/vertexai';
import EventEmitter from 'events';

import Agent from '@sre/AgentManager/Agent.class';
import { JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { TLLMParams, TLLMMessageBlock, TLLMMessageRole } from '@sre/types/LLM.types';
import { VaultHelper } from '@sre/Security/Vault.service/Vault.helper';
import { ConnectorService } from '@sre/Core/ConnectorsService';

import { ImagesResponse, LLMChatResponse, LLMConnector } from '../LLMConnector';

const console = Logger('VertexAIConnector');

export class VertexAIConnector extends LLMConnector {
    public name = 'LLM:VertexAI';

    protected async chatRequest(acRequest: AccessRequest, prompt, params): Promise<LLMChatResponse> {
        const _params = { ...params };
        _params.messages = _params?.messages || [];

        if (prompt) {
            _params.messages.push({ role: TLLMMessageRole.User, content: prompt });
        }

        const hasSystemMessage = this.llmHelper.MessageProcessor().hasSystemMessage(_params.messages);
        if (hasSystemMessage) {
            const { systemMessage, otherMessages } = this.llmHelper.MessageProcessor().separateSystemMessages(_params.messages);
            _params.messages = otherMessages;
            _params.systemInstruction = { role: 'system', parts: [{ text: (systemMessage as TLLMMessageBlock)?.content }] };
        } else {
            _params.systemInstruction = { role: 'system', parts: [{ text: JSON_RESPONSE_INSTRUCTION }] };
        }

        const modelInfo = await this.llmHelper.ModelRegistry().getModelInfo(_params.model);

        const generationConfig: GenerationConfig = {};
        if (_params?.max_tokens !== undefined) generationConfig.maxOutputTokens = _params.max_tokens;
        if (_params?.temperature !== undefined) generationConfig.temperature = _params.temperature;
        if (_params?.stop_sequences?.length) generationConfig.stopSequences = _params.stop_sequences;
        if (_params?.top_p !== undefined) generationConfig.topP = _params.top_p;
        if (_params?.top_k !== undefined) generationConfig.topK = _params.top_k;

        const modelParams: ModelParams = {
            model: modelInfo.settings?.customModel || modelInfo.settings?.foundationModel,
        };

        if (Object.keys(generationConfig).length > 0) {
            modelParams.generationConfig = generationConfig;
        }

        try {
            const accountConnector = ConnectorService.getAccountConnector();
            const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);

            const client = await this.getVertexAIClient(modelInfo, teamId);
            const generativeModel = client.getGenerativeModel(modelParams);

            const contents = Array.isArray(_params.messages) ? this.getConsistentMessages(_params.messages) : [];
            const result = await generativeModel.generateContent({ contents });
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

    public async extractVisionLLMParams(config: any) {
        const params: TLLMParams = await super.extractVisionLLMParams(config);
        return params;
    }

    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto' }) {
        throw new Error('Tool configuration is not currently implemented for Vertex AI');
    }

    private async getVertexAIClient(modelInfo: any, teamId: string) {
        try {
            const jsonCredentials = await VaultHelper.getTeamKey(modelInfo.settings?.jsonCredentialsName, teamId);
            const credentials = JSON.parse(jsonCredentials);

            return new VertexAI({
                project: modelInfo.settings.projectId,
                location: modelInfo.settings.region,
                googleAuthOptions: {
                    credentials,
                },
                apiEndpoint: `${modelInfo.settings.region}-aiplatform.googleapis.com`,
            });
        } catch (error) {
            console.error('Error on initializing Vertex AI client.');
            throw error;
        }
    }

    private getConsistentMessages(messages) {
        return messages.map((message) => {
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
