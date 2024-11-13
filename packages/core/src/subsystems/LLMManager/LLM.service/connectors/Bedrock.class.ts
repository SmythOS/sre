import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import EventEmitter from 'events';

import Agent from '@sre/AgentManager/Agent.class';
import { JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { TLLMParams, TLLMMessageBlock, TLLMMessageRole } from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { customModels } from '@sre/LLMManager/custom-models';

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

    protected async chatRequest(acRequest: AccessRequest, params: TLLMParams): Promise<LLMChatResponse> {
        const _params = JSON.parse(JSON.stringify(params)); // Avoid mutation of the original params
        let messages = _params?.messages || [];

        //#region Separate system message and add JSON response instruction if needed
        let systemPrompt;
        const { systemMessage, otherMessages } = LLMHelper.separateSystemMessages(messages);

        if ('content' in systemMessage) {
            systemPrompt = systemMessage.content;
        }

        messages = otherMessages;

        const responseFormat = _params?.responseFormat || '';
        if (responseFormat === 'json') {
            systemPrompt = [{ text: JSON_RESPONSE_INSTRUCTION }];
        }

        const modelInfo = _params.modelInfo;
        const supportsSystemPrompt = customModels[modelInfo?.settings?.foundationModel]?.supportsSystemPrompt;

        if (!supportsSystemPrompt) {
            messages[0].content?.push(systemPrompt[0]);
            systemPrompt = undefined; // Reset system prompt if it's not supported
        }

        //#endregion Separate system message and add JSON response instruction if needed

        const modelId = modelInfo.settings?.customModel || modelInfo.settings?.foundationModel;

        const inferenceConfig: InferenceConfig = {};
        if (_params?.maxTokens !== undefined) inferenceConfig.maxTokens = _params.maxTokens;
        if (_params?.temperature !== undefined) inferenceConfig.temperature = _params.temperature;
        if (_params?.topP !== undefined) inferenceConfig.topP = _params.topP;
        if (_params?.stopSequences?.length) inferenceConfig.stopSequences = _params.stopSequences;

        const converseCommandInput: any = {
            modelId,
            messages,
        };

        if (Object.keys(inferenceConfig).length > 0) {
            converseCommandInput.inferenceConfig = inferenceConfig;
        }

        if (systemPrompt) {
            converseCommandInput.system = systemPrompt;
        }

        const command = new ConverseCommand(converseCommandInput);

        try {
            const keyId = _params?.credentials?.keyId;
            const secretKey = _params?.credentials?.secretKey;
            const sessionToken = _params?.credentials?.sessionKey;

            const credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string } = {
                accessKeyId: keyId,
                secretAccessKey: secretKey,
            };

            if (sessionToken) {
                credentials.sessionToken = sessionToken;
            }

            const client = new BedrockRuntimeClient({
                region: modelInfo.settings.region,
                credentials,
            });

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

    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto' }) {
        throw new Error('Tool configuration is not supported for Bedrock.');
    }

    public getConsistentMessages(messages: TLLMMessageBlock[]): TLLMMessageBlock[] {
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
                content: textBlock,
            };
        });
    }
}
