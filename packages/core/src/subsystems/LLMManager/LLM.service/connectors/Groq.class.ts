import Groq from 'groq-sdk';
import EventEmitter from 'events';

import Agent from '@sre/AgentManager/Agent.class';
import { TOOL_USE_DEFAULT_MODEL, JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { LLMParams, LLMMessageBlock } from '@sre/types/LLM.types';

import { LLMChatResponse, LLMConnector } from '../LLMConnector';

const console = Logger('GroqConnector');

export class GroqConnector extends LLMConnector {
    public name = 'LLM:Groq';

    protected async chatRequest(acRequest: AccessRequest, prompt, params): Promise<LLMChatResponse> {
        try {
            params.messages = params?.messages || [];

            if (this.hasSystemMessage(params.messages)) {
                const { systemMessage, otherMessages } = this.separateSystemMessages(params.messages);
                params.messages = [systemMessage, ...otherMessages];
            } else {
                params.messages.unshift({
                    role: 'system',
                    content: JSON_RESPONSE_INSTRUCTION,
                });
            }

            if (prompt) {
                params.messages.push({ role: 'user', content: prompt });
            }

            const apiKey = params?.apiKey;
            if (!apiKey) throw new Error('Please provide an API key for Groq');

            const groq = new Groq({ apiKey });

            // TODO: implement groq specific token counting
            // this.validateTokensLimit(params);

            const response: any = await groq.chat.completions.create(params);
            const content = response.choices[0]?.message?.content;
            const finishReason = response.choices[0]?.finish_reason;

            return { content, finishReason };
        } catch (error) {
            console.error('Error in groq chatRequest', error);
            throw error;
        }
    }

    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent?: string | Agent): Promise<LLMChatResponse> {
        throw new Error('Vision requests are not supported by Groq');
    }

    protected async toolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        throw new Error('Tool requests are not yet implemented for Groq');
    }

    protected async streamToolRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<any> {
        throw new Error('Stream tool requests are not yet implemented for Groq');
    }

    protected async streamRequest(
        acRequest: AccessRequest,
        { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
    ): Promise<EventEmitter> {
        throw new Error('Stream requests are not yet implemented for Groq');
    }

    public async extractVisionLLMParams(config: any) {
        const params: LLMParams = await super.extractVisionLLMParams(config);

        return params;
    }

    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto' }) {
        throw new Error('Tool configuration is not yet implemented for Groq');
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
