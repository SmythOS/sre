import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { LLMChatResponse, LLMConnector } from '../LLMConnector';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import EventEmitter from 'events';
import { Readable } from 'stream';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { APIKeySource } from '@sre/types/LLM.types';
import { Agent } from '@sre/AgentManager/Agent.class';

export class EchoConnector extends LLMConnector {
    public name = 'LLM:Echo';
    protected async chatRequest(acRequest: AccessRequest, params, agent: string | Agent): Promise<LLMChatResponse> {
        const content = params?.messages?.[0]?.content; // As Echo model only used in PromptGenerator so we can assume the first message is the user message to echo
        return { content, finishReason: 'stop' } as LLMChatResponse;
    }
    protected async visionRequest(acRequest: AccessRequest, prompt, params, agent: string | Agent) {
        return { content: prompt, finishReason: 'stop' } as LLMChatResponse;
    }
    protected async multimodalRequest(acRequest: AccessRequest, prompt, params, agent: string | Agent) {
        return { content: prompt, finishReason: 'stop' } as LLMChatResponse;
    }
    protected async toolRequest(acRequest: AccessRequest, params, agent: string | Agent) {
        throw new Error('Echo model does not support tool requests');
    }
    protected async imageGenRequest(acRequest: AccessRequest, prompt, params: any, agent: string | Agent): Promise<any> {
        throw new Error('Image generation request is not supported for Echo.');
    }
    protected async streamToolRequest(acRequest: AccessRequest, params, agent: string | Agent) {
        throw new Error('Echo model does not support tool requests');
    }
    protected async streamRequest(acRequest: AccessRequest, params: any, agent: string | Agent): Promise<EventEmitter> {
        const emitter = new EventEmitter();
        let content = '';

        if (Array.isArray(params?.messages)) {
            content = params?.messages?.filter((m) => m.role === 'user').pop()?.content;
        }
        //params?.messages?.[0]?.content;

        // Process stream asynchronously as we need to return emitter immediately
        (async () => {
            // Simulate streaming by splitting content into chunks
            const chunks = content.split(' ');

            for (let i = 0; i < chunks.length; i++) {
                // Simulate network delay
                await new Promise((resolve) => setTimeout(resolve, 50));

                const isLastChunk = i === chunks.length - 1;
                // Add space between chunks except for the last one to avoid trailing space in file URLs
                const delta = { content: chunks[i] + (isLastChunk ? '' : ' ') };
                emitter.emit('data', delta);
                emitter.emit('content', delta.content);
            }

            // Emit end event after all chunks are processed
            setTimeout(() => {
                emitter.emit('end', [], []); // Empty arrays for toolsData and usage_data
            }, 100);
        })();

        return emitter;
    }
    protected async multimodalStreamRequest(acRequest: AccessRequest, params: any, agent: string | Agent): Promise<EventEmitter> {
        throw new Error('Echo model does not support passthrough with File(s)');
    }

    public enhancePrompt(prompt: string, config: any) {
        //Echo model does not require enhancements, because we are just echoing the prompt as is.
        return prompt;
    }

    public postProcess(response: any) {
        try {
            const result = JSONContent(response).tryFullParse();
            if (result?.error) {
                return response;
            }
            return result;
        } catch (error) {
            return response;
        }
    }

    protected reportUsage(usage: any, metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }) {}
}
