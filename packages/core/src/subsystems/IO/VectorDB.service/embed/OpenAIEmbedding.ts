import OpenAI, { type ClientOptions, OpenAI as OpenAIClient } from 'openai';
import { BaseEmbedding, TEmbeddings } from './BaseEmbedding';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { getLLMCredentials } from '@sre/LLMManager/LLM.service/LLMCredentials.helper';
import { TLLMCredentials, TLLMModel } from '@sre/types/LLM.types';

// Helper function to create OpenAI API errors
const createOpenAIError = (statusCode: number, error: any) => {
    return new OpenAI.APIError(
        statusCode,
        {
            code: error?.errKey || error?.code,
            message: error?.message,
            type: error?.name,
        },
        error?.message,
        null
    );
};

const DEFAULT_MODEL = 'text-embedding-3-large';

export class OpenAIEmbeds extends BaseEmbedding {
    protected client: OpenAIClient;
    protected clientConfig: ClientOptions;

    public static models = ['text-embedding-3-large', 'text-embedding-ada-002'];
    public canSpecifyDimensions = true;

    constructor(private settings?: Partial<TEmbeddings>) {
        super({ model: settings?.model ?? DEFAULT_MODEL, ...settings });

        this.clientConfig = {
            //apiKey: fields?.credentials?.apiKey || process.env.OPENAI_API_KEY || '',
            dangerouslyAllowBrowser: true,
        };

        if (this.model === 'text-embedding-ada-002') {
            this.canSpecifyDimensions = false; // special case for ada-002, it doesn't support dimensions passing
        }
    }

    async embedTexts(texts: string[], candidate: AccessCandidate): Promise<number[][]> {
        // we split into batches to avoid provider limits
        const batches = this.chunkArr(this.processTexts(texts), this.batchSize);

        const batchRequests = batches.map((batch) => {
            const params: OpenAIClient.EmbeddingCreateParams = {
                model: this.model,
                input: batch,
            };
            if (this.dimensions && this.canSpecifyDimensions) {
                params.dimensions = this.dimensions;
            }
            return this.embed(params, candidate);
        });
        const batchResponses = await Promise.all(batchRequests);

        const embeddings: number[][] = [];
        for (let i = 0; i < batchResponses.length; i += 1) {
            const batch = batches[i];
            const { data: batchResponse } = batchResponses[i];
            for (let j = 0; j < batch.length; j += 1) {
                embeddings.push(batchResponse[j].embedding);
            }
        }
        return embeddings;
    }

    async embedText(text: string, candidate: AccessCandidate): Promise<number[]> {
        const params: OpenAIClient.EmbeddingCreateParams = {
            model: this.model,
            input: this.processTexts([text])[0],
        };
        if (this.dimensions && this.canSpecifyDimensions) {
            params.dimensions = this.dimensions;
        }
        const { data } = await this.embed(params, candidate);
        return data[0].embedding;
    }

    protected async embed(request: OpenAIClient.EmbeddingCreateParams, candidate: AccessCandidate) {
        const modelInfo: TLLMModel = {
            provider: 'OpenAI',
            modelId: this.model,
            credentials: (this.settings?.credentials as unknown as TLLMCredentials) || [TLLMCredentials.Internal, TLLMCredentials.Vault],
        };
        const credentials = await getLLMCredentials(candidate, modelInfo);

        if (!this.client) {
            const params: ClientOptions = {
                ...this.clientConfig,
                apiKey: credentials.apiKey,
                timeout: this.timeout,
                maxRetries: 0,
            };

            this.client = new OpenAIClient(params);
        }
        try {
            const res = await this.client.embeddings.create(request);
            return res;
        } catch (e) {
            // const error = wrapOpenAIClientError(e);
            // import openapi error from openai and throw it
            const error = createOpenAIError(e.statusCode, e);
            throw error;
        }
    }
}
