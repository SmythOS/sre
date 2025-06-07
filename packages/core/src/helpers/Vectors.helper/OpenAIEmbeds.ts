import OpenAI, { type ClientOptions, OpenAI as OpenAIClient } from 'openai';

export interface OpenAIEmbeddingsParams {
    modelName: string;
    model: string;
    dimensions?: number;
    timeout?: number;
    chunkSize?: number;
    stripNewLines?: boolean;
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

export class OpenAIEmbeds implements Partial<OpenAIEmbeddingsParams> {
    model = 'text-embedding-ada-002'; //text-embedding-3-large
    modelName: string;
    chunkSize = 512;
    stripNewLines = true;
    dimensions?: number;
    timeout?: number;
    protected client: OpenAIClient;
    protected clientConfig: ClientOptions;

    constructor(
        fields?: Partial<OpenAIEmbeddingsParams> & {
            verbose?: boolean;
            openAIApiKey?: string;
            model?: string;
            apiKey?: string;
            configuration?: ClientOptions;
        },
    ) {
        const fieldsWithDefaults = { maxConcurrency: 2, ...fields };

        const apiKey = fieldsWithDefaults?.apiKey ?? fieldsWithDefaults?.openAIApiKey;

        this.model = fieldsWithDefaults?.model ?? fieldsWithDefaults?.modelName ?? this.model;
        this.modelName = this.model;
        this.chunkSize = fieldsWithDefaults?.chunkSize ?? this.chunkSize;
        this.stripNewLines = fieldsWithDefaults?.stripNewLines ?? this.stripNewLines;
        this.timeout = fieldsWithDefaults?.timeout;
        this.dimensions = fieldsWithDefaults?.dimensions;

        this.clientConfig = {
            apiKey,
            dangerouslyAllowBrowser: true,
            ...fields?.configuration,
        };
    }

    async embedTexts(texts: string[]): Promise<number[][]> {
        const batches = this.chunkArr(this.stripNewLines ? texts.map((t) => t.replace(/\n/g, ' ')) : texts, this.chunkSize);

        const batchRequests = batches.map((batch) => {
            const params: OpenAIClient.EmbeddingCreateParams = {
                model: this.model,
                input: batch,
            };
            if (this.dimensions) {
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
            input: this.stripNewLines ? text.replace(/\n/g, ' ') : text,
        };
        if (this.dimensions) {
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

    private chunkArr<T>(arr: T[], sizePerChunk: number) {
        return arr.reduce((chunks, elem, index) => {
            const chunkIndex = Math.floor(index / sizePerChunk);
            const chunk = chunks[chunkIndex] || [];
            chunks[chunkIndex] = chunk.concat([elem]);
            return chunks;
        }, [] as T[][]);
    }
}
