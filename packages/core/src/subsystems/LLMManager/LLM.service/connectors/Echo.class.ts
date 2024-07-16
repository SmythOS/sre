import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { ILLMConnector } from '../ILLMConnector';
import { LLMConnector } from '../LLMConnector';

export class EchoConnector extends LLMConnector implements ILLMConnector {
    public name = 'LLM:Echo';
    async chatRequest(prompt, params) {
        return prompt;
    }
    async visionRequest(prompt, params) {
        return prompt;
    }
    async toolRequest(params) {
        return prompt;
    }

    public enhancePrompt(prompt: string, config: any) {
        //Echo model does not require enhancements, because we are just echoing the prompt as is.
        return prompt;
    }

    public postProcess(response: any) {
        try {
            return JSONContent(response).tryParse();
        } catch (error) {
            return response;
        }
    }
}
