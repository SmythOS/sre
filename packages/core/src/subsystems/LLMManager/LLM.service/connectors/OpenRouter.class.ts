import { BasicCredentials, ILLMRequestContext } from '@sre/types/LLM.types';
import { OpenAIConnector } from './OpenAI.class';

/**
 * Connector for OpenRouter (https://openrouter.ai) using the OpenAI SDK.
 * OpenRouter is API compatible with OpenAI, so we extend the OpenAI connector
 * and simply override the API endpoint and default headers.
 */
export class OpenRouterConnector extends OpenAIConnector {
    public name = 'LLM:OpenRouter';

    protected async getClient(params: ILLMRequestContext) {
        const apiKey = (params.credentials as BasicCredentials)?.apiKey;
        if (!apiKey) throw new Error('Please provide an API key for OpenRouter');

        // Use OpenRouter base URL and required headers
        return new (await import('openai')).default({
            apiKey,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'https://github.com/smythos/sre',
                'X-Title': 'SmythOS',
            },
        });
    }
}
