import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import EventEmitter from 'events';

import Agent from '@sre/AgentManager/Agent.class';
import { JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { TLLMParams, TLLMMessageBlock, ToolData, TLLMMessageRole } from '@sre/types/LLM.types';
import { VaultHelper } from '@sre/Security/Vault.service/Vault.helper';
import { ConnectorService } from '@sre/Core/ConnectorsService';

import { ImagesResponse, LLMChatResponse, LLMConnector } from '../LLMConnector';

const console = Logger('BedrockConnector');

type InferenceConfig = {
    maxTokens?: number;
    temperature?: number;
    stopSequences?: string[];
    topP?: number;
};

export class BedrockConnector extends LLMConnector {
    public name = 'LLM:Bedrock';

    protected async chatRequest(acRequest: AccessRequest, prompt, params): Promise<LLMChatResponse> {
        const _params = { ...params };
        let messages = _params?.messages || [];

        if (prompt) {
            messages.push({ role: TLLMMessageRole.User, content: prompt });
        }

        const hasSystemMessage = this.llmHelper.MessageProcessor().hasSystemMessage(messages);
        if (hasSystemMessage) {
            const { systemMessage, otherMessages } = this.llmHelper.MessageProcessor().separateSystemMessages(messages);
            messages = otherMessages;
            _params.system = [{ text: (systemMessage as TLLMMessageBlock)?.content }];
        } else {
            _params.system = [{ text: JSON_RESPONSE_INSTRUCTION }];
        }

        const modelInfo = await this.llmHelper.ModelRegistry().getModelInfo(_params.model);

        const modelId = modelInfo.settings?.customModel || modelInfo.settings?.foundationModel;
        messages = Array.isArray(messages) ? this.getConsistentMessages(messages) : [];

        const inferenceConfig: InferenceConfig = {};
        if (_params?.max_tokens !== undefined) inferenceConfig.maxTokens = _params.max_tokens;
        if (_params?.temperature !== undefined) inferenceConfig.temperature = _params.temperature;
        if (_params?.stop_sequences?.length) inferenceConfig.stopSequences = _params.stop_sequences;
        if (_params?.top_p !== undefined) inferenceConfig.topP = _params.top_p;

        const converseCommandInput: any = {
            modelId,
            messages,
        };

        if (Object.keys(inferenceConfig).length > 0) {
            converseCommandInput.inferenceConfig = inferenceConfig;
        }

        if (_params?.system) {
            converseCommandInput.system = _params?.system;
        }

        const command = new ConverseCommand(converseCommandInput);

        try {
            const accountConnector = ConnectorService.getAccountConnector();
            const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);

            const client = await this.getBedrockClient(modelInfo, teamId);
            const response = await client.send(command);
            const content = response.output?.message?.content?.[0]?.text;
            return { content, finishReason: 'stop' };
        } catch (error) {
            throw error;
        }
    }

    protected async streamToolRequest(acRequest: AccessRequest, { model, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }): Promise<any> {
        throw new Error('streamToolRequest() is Deprecated!');
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Vision requests are not supported by Bedrock');
    }

    protected async multimodalRequest(acRequest: AccessRequest, prompt, params: any, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Multimodal request is not supported for Bedrock.');
    }

    protected async toolRequest(acRequest: AccessRequest, params): Promise<any> {
        throw new Error('Tool requests are not supported by Bedrock');
    }

    protected async imageGenRequest(acRequest: AccessRequest, prompt, params: any, agent?: string | Agent): Promise<ImagesResponse> {
        throw new Error('Image generation request is not supported for Bedrock.');
    }

    protected async streamRequest(acRequest: AccessRequest, params): Promise<EventEmitter> {
        throw new Error('Streaming is not supported for Bedrock.');
    }

    public async extractVisionLLMParams(config: any) {
        const params: TLLMParams = await super.extractVisionLLMParams(config);
        return params;
    }

    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto' }) {
        throw new Error('Tool configuration is not supported for Bedrock.');
    }

    private async getBedrockClient(modelInfo: any, teamId: string) {
        try {
            const keyId = await VaultHelper.getTeamKey(modelInfo.settings?.keyIDName, teamId);
            const secretKey = await VaultHelper.getTeamKey(modelInfo.settings?.secretKeyName, teamId);
            const sessionKey = await VaultHelper.getTeamKey(modelInfo.settings?.sessionKeyName, teamId);

            const credentials: any = {
                accessKeyId: keyId || '',
                secretAccessKey: secretKey || '',
            };

            if (sessionKey) {
                credentials['sessionToken'] = sessionKey;
            }

            return new BedrockRuntimeClient({
                region: modelInfo.settings.region,
                credentials,
            });
        } catch (error) {
            console.error('Error on initializing Bedrock client.');
            throw error;
        }
    }

    private getConsistentMessages(messages: TLLMMessageBlock[]): TLLMMessageBlock[] {
        return messages.map((message) => {
            let textBlock = [];

            if (message?.parts) {
                textBlock = message.parts;
            } else if (message?.content) {
                textBlock = Array.isArray(message.content) ? message.content : [{ text: message.content as string }];
            }

            return {
                role: message.role,
                content: textBlock,
            };
        });
    }
}
