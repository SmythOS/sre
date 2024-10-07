import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { ImagesResponse, LLMChatResponse, LLMConnector } from '../LLMConnector';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import EventEmitter from 'events';
import { Readable } from 'stream';

export class EchoConnector extends LLMConnector {
    public name = 'LLM:Echo';
    protected async chatRequest(acRequest: AccessRequest, prompt, params): Promise<LLMChatResponse> {
        return { content: prompt, finishReason: 'stop' } as LLMChatResponse;
    }
    protected async visionRequest(acRequest: AccessRequest, prompt, params) {
        return { content: prompt, finishReason: 'stop' } as LLMChatResponse;
    }
    protected async multimodalRequest(acRequest: AccessRequest, prompt, params) {
        return { content: prompt, finishReason: 'stop' } as LLMChatResponse;
    }
    protected async toolRequest(acRequest: AccessRequest, params) {
        throw new Error('Echo model does not support tool requests');
    }
    protected async imageGenRequest(acRequest: AccessRequest, prompt, params: any): Promise<ImagesResponse> {
        throw new Error('Image generation request is not supported for Echo.');
    }
    protected async streamToolRequest(acRequest: AccessRequest, params) {
        throw new Error('Echo model does not support tool requests');
    }
    protected async streamRequest(acRequest: AccessRequest, params: any): Promise<Readable> {
        throw new Error('Echo model does not support streaming');
    }

    public enhancePrompt(prompt: string, config: any) {
        //Echo model does not require enhancements, because we are just echoing the prompt as is.
        return prompt;
    }

    public postProcess(response: any) {
        // We don't need any post processing for Echo.
        return response;
    }
}
