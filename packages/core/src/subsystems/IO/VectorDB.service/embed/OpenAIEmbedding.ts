import OpenAI, { type ClientOptions, OpenAI as OpenAIClient } from 'openai';
import { BaseEmbedding, type BaseEmbeddingParams } from './BaseEmbedding';

export interface OpenAIEmbeddingsParams extends BaseEmbeddingParams {
    // OpenAI-specific parameters can be added here if needed
}

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
        null,
    );
};

const DEFAULT_MODEL = 'text-embedding-ada-002';

export class OpenAIEmbeds extends BaseEmbedding implements Partial<OpenAIEmbeddingsParams> {
    protected client: OpenAIClient;
    protected clientConfig: ClientOptions;

    public static models = ['text-embedding-ada-002', 'text-embedding-3-large'];
    public canSpecifyDimensions = true;

    constructor(
        fields?: Partial<OpenAIEmbeddingsParams> & {
            verbose?: boolean;
            model?: (typeof OpenAIEmbeds.models)[number];
            apiKey?: string;
            configuration?: ClientOptions;
        },
    ) {
        super({ maxConcurrency: 2, model: fields?.model ?? DEFAULT_MODEL, ...fields });

        this.clientConfig = {
            apiKey: fields?.apiKey || process.env.OPENAI_API_KEY || '',
            dangerouslyAllowBrowser: true,
            ...fields?.configuration,
        };

        if (this.model === 'text-embedding-ada-002') {
            this.canSpecifyDimensions = false; // special case for ada-002, it doesn't support dimensions passing
        }
    }

    async embedTexts(texts: string[]): Promise<number[][]> {
        const batches = this.chunkArr(this.processTexts(texts), this.chunkSize);

        const batchRequests = batches.map((batch) => {
            const params: OpenAIClient.EmbeddingCreateParams = {
                model: this.model,
                input: batch,
            };
            if (this.dimensions && this.canSpecifyDimensions) {
                params.dimensions = this.dimensions;
            }
            return this.embed(params);
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

    async embedText(text: string): Promise<number[]> {
        const params: OpenAIClient.EmbeddingCreateParams = {
            model: this.model,
            input: this.processTexts([text])[0],
        };
        if (this.dimensions && this.canSpecifyDimensions) {
            params.dimensions = this.dimensions;
        }
        const { data } = await this.embed(params);
        return data[0].embedding;
    }

    protected async embed(request: OpenAIClient.EmbeddingCreateParams) {
        if (!this.client) {
            const params: ClientOptions = {
                ...this.clientConfig,
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
