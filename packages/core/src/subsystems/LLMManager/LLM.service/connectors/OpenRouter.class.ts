import { OpenAIConnector, TOpenAIConnectorParams } from './OpenAI.class';
import { TLLMProvider } from '@sre/types/LLM.types';
import { Logger } from '@sre/helpers/Log.helper';

const console = Logger('OpenRouter');

export class OpenRouterConnector extends OpenAIConnector {
    public name: string = 'OpenRouter';
    public provider: TLLMProvider = 'OpenRouter';

    constructor(params?: TOpenAIConnectorParams) {
        super(params);
        this.client = this.getClient(params?.apiKey);
    }

    protected async getClient(apiKey?: string) {
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
