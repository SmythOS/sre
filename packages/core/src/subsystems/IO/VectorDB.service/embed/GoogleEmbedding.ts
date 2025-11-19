import { GoogleGenAI } from '@google/genai';
import { BaseEmbedding, TEmbeddings } from './BaseEmbedding';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { getLLMCredentials } from '@sre/LLMManager/LLM.service/LLMCredentials.helper';
import { TLLMCredentials, TLLMModel, BasicCredentials } from '@sre/types/LLM.types';

const DEFAULT_MODEL = 'gemini-embedding-001';

export class GoogleEmbeds extends BaseEmbedding {
    protected client: GoogleGenAI;

    // Keep in sync with Gemini API supported embedding models
    public static models = ['gemini-embedding-001', 'text-embedding-005', 'text-multilingual-embedding-002'];
    public canSpecifyDimensions = true;

    constructor(private settings?: Partial<TEmbeddings>) {
        super({ model: settings?.model ?? DEFAULT_MODEL, ...settings });
    }

    async embedTexts(texts: string[], candidate: AccessCandidate): Promise<number[][]> {
        // we split into batches to avoid provider limits
        const batches = this.chunkArr(this.processTexts(texts), this.chunkSize);

        const batchRequests = batches.map((batch) => {
            return this.embed(batch, candidate);
        });
        const batchResponses = await Promise.all(batchRequests);

        const embeddings: number[][] = [];
        for (let i = 0; i < batchResponses.length; i += 1) {
            const batch = batches[i];
            const batchResponse = batchResponses[i];
            for (let j = 0; j < batch.length; j += 1) {
                embeddings.push(batchResponse[j]);
            }
        }
        return embeddings;
    }

    async embedText(text: string, candidate: AccessCandidate): Promise<number[]> {
        const processedText = this.processTexts([text])[0];
        const embeddings = await this.embed([processedText], candidate);
        return embeddings[0];
    }

    protected async embed(texts: string[], candidate: AccessCandidate): Promise<number[][]> {
        let apiKey: string | undefined;

        // Try to get from credentials first
        try {
            const modelInfo: TLLMModel = {
                provider: 'GoogleAI',
                modelId: this.model,
                credentials: (this.settings?.credentials as unknown as TLLMCredentials) || [TLLMCredentials.Internal, TLLMCredentials.Vault],
            };
            const credentials = await getLLMCredentials(candidate, modelInfo);
            apiKey = (credentials as BasicCredentials)?.apiKey;
        } catch (e) {
            // If credential system fails, fall back to environment variable
        }

        // Fall back to environment variable if not found in credentials
        if (!apiKey) {
            apiKey = process.env.GOOGLE_AI_API_KEY;
        }

        if (!apiKey) {
            throw new Error('Please provide an API key for Google AI embeddings via credentials or GOOGLE_AI_API_KEY environment variable');
        }

        if (!this.client) {
            this.client = new GoogleGenAI({ apiKey });
        }

        try {
            const outputDimensionality = this.dimensions && Number.isFinite(this.dimensions) ? this.dimensions : undefined;

            // Batch request using the new SDK
            const res = await this.client.models.embedContent({
                model: this.model,
                contents: texts,
                ...(outputDimensionality ? { outputDimensionality } : {}),
            });

            // The SDK can return either { embedding } for single or { embeddings } for batch
            const vectors: number[][] = Array.isArray((res as any).embeddings)
                ? (res as any).embeddings.map((e: any) => e.values as number[])
                : [((res as any).embedding?.values as number[]) || []];

            // Enforce dimensions and normalization when requested or when non-3072
            const targetDim = outputDimensionality;
            const processed = vectors.map((v) => this.postProcessEmbedding(v, targetDim));

            return processed;
        } catch (e) {
            throw new Error(`Google Embeddings API error: ${e.message || e}`);
        }
    }

    private postProcessEmbedding(values: number[], targetDim?: number): number[] {
        let v = Array.isArray(values) ? values.slice() : [];
        if (targetDim && targetDim > 0) {
            if (v.length > targetDim) {
                // SDK ignored smaller dimension: truncate
                v = v.slice(0, targetDim);
            } else if (v.length < targetDim) {
                // SDK returned shorter vector: pad with zeros
                v = v.concat(Array(targetDim - v.length).fill(0));
            }
        }
        // Normalize for non-default 3072 dims (recommended by Google docs)
        const needNormalize = (targetDim && targetDim !== 3072) || (!targetDim && v.length !== 3072);
        if (needNormalize && v.length > 0) {
            const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
            if (norm > 0) v = v.map((x) => x / norm);
        }
        return v;
    }
}
