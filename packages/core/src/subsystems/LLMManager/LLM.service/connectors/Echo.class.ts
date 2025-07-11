import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { LLMConnector } from '../LLMConnector';
import EventEmitter from 'events';
import { APIKeySource, ILLMRequestFuncParams, TLLMChatResponse, TLLMConnectorParams, TLLMParams } from '@sre/types/LLM.types';

export class EchoConnector extends LLMConnector {
    public name = 'LLM:Echo';

    protected async request({ acRequest, body, context }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        const content = body?.messages?.[0]?.content; // As Echo model only used in PromptGenerator so we can assume the first message is the user message to echo
        return {
            content,
            finishReason: 'stop',
            useTool: false,
            toolsData: [],
            message: { content, role: 'assistant' },
            usage: {},
        } as TLLMChatResponse;
    }

    protected async streamRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        const emitter = new EventEmitter();
        let content = '';

        if (Array.isArray(body?.messages)) {
            content = body?.messages?.filter((m) => m.role === 'user').pop()?.content;
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

    protected async webSearchRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        throw new Error('Web search is not supported for Echo');
    }

    protected async reqBodyAdapter(params: TLLMParams): Promise<any> {
        return params;
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
