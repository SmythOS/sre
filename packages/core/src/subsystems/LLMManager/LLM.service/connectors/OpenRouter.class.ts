import { OpenAIConnector } from './OpenAI.class';
import { BasicCredentials, ILLMRequestContext } from '@sre/types/LLM.types';
import { Logger } from '@sre/helpers/Log.helper';

const console = Logger('OpenRouter');

export class OpenRouterConnector extends OpenAIConnector {
    public name = 'LLM:OpenRouter';

    protected async getClient(params: ILLMRequestContext) {
        let apiKey = (params.credentials as BasicCredentials)?.apiKey;
        if (!apiKey) apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            throw new Error('Please provide an API key for OpenRouter');
        }

        // Use OpenRouter base URL and required headers
        return new (await import('openai')).default({
            apiKey,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'https://smythos.com',
                'X-Title': 'SmythOS',
            },
        });
    }
}
