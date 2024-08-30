import OpenAI from 'openai';
import config from '@sre/config';
import Agent from '@sre/AgentManager/Agent.class';
import { JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { LLMParams, LLMMessageBlock } from '@sre/types/LLM.types';
import { LLMChatResponse, LLMConnector } from '../LLMConnector';
import EventEmitter from 'events';

const console = Logger('TogetherAIConnector');

export class TogetherAIConnector extends LLMConnector {
    public name = 'LLM:TogetherAI';

    protected async chatRequest(acRequest: AccessRequest, prompt, params): Promise<LLMChatResponse> {
        try {
            if (!params.messages) params.messages = [];

            if (params.messages[0]?.role !== 'system') {
                params.messages.unshift({
                    role: 'system',
                    content: JSON_RESPONSE_INSTRUCTION,
                });
            }

            if (prompt) {
                params.messages.push({ role: 'user', content: prompt });
            }

            params.messages = this.formatInputMessages(params.messages);

            const apiKey = params?.apiKey;
            delete params.apiKey;

            const openai = new OpenAI({
                apiKey: apiKey || process.env.TOGETHER_AI_API_KEY,
                baseURL: config.env.TOGETHER_AI_API_URL,
            });

            // TODO: implement together.ai specific token counting
            // this.validateTokensLimit(params);

            const response: any = await openai.chat.completions.create(params);

            const content =
                response?.choices?.[0]?.text ||
                response?.choices?.[0]?.message.content ||
                response?.data?.choices?.[0]?.text ||
                response?.data?.choices?.[0]?.message.content;

            const finishReason = response?.choices?.[0]?.finish_reason;

            return { content, finishReason };
        } catch (error) {
            console.error('Error in TogetherAI chatRequest', error);
            throw error;
        }
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Vision requests are not supported by TogetherAI');
    }

    protected async toolRequest(acRequest: AccessRequest, params): Promise<any> {
        throw new Error('Tool requests are not yet implemented for TogetherAI');
    }

    protected async streamToolRequest(acRequest: AccessRequest, params): Promise<any> {
        throw new Error('Stream tool requests are not yet implemented for TogetherAI');
    }

    protected async streamRequest(acRequest: AccessRequest, params: any): Promise<EventEmitter> {
        throw new Error('Stream requests are not yet implemented for TogetherAI');
    }

    public async extractVisionLLMParams(config: any) {
        const params: LLMParams = await super.extractVisionLLMParams(config);

        return params;
    }

    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto' }) {
        throw new Error('Tool configuration is not yet implemented for TogetherAI');
    }

    private formatInputMessages(messages: LLMMessageBlock[]): LLMMessageBlock[] {
        return messages.map((message) => {
            let textContent = '';

            if (Array.isArray(message.content)) {
                textContent = message.content.map((textBlock) => textBlock?.text || '').join(' ');
            } else if (typeof message.content === 'string') {
                textContent = message.content;
            }

            return {
                role: message.role,
                content: textContent,
            };
        });
    }
}
