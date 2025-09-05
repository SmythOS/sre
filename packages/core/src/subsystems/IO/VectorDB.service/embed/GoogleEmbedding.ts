import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseEmbedding, TEmbeddings } from './BaseEmbedding';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { getLLMCredentials } from '@sre/LLMManager/LLM.service/LLMCredentials.helper';
import { TLLMCredentials, TLLMModel, BasicCredentials } from '@sre/types/LLM.types';

const DEFAULT_MODEL = 'gemini-embedding-001';

export class GoogleEmbeds extends BaseEmbedding {
    protected client: GoogleGenerativeAI;

    public static models = ['gemini-embedding-001'];
    public canSpecifyDimensions = true;

    constructor(private settings?: Partial<TEmbeddings>) {
        super({ model: settings?.model ?? DEFAULT_MODEL, ...settings });
    }

    async embedTexts(texts: string[], candidate: AccessCandidate): Promise<number[][]> {
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
                credentials: this.settings?.credentials as unknown as TLLMCredentials,
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
            this.client = new GoogleGenerativeAI(apiKey);
        }

        try {
            const model = this.client.getGenerativeModel({ model: this.model });
            
            const embeddings: number[][] = [];
            
            for (const text of texts) {
                const result = await model.embedContent(text);
                if (result?.embedding?.values) {
                    embeddings.push(result.embedding.values);
                } else {
                    throw new Error('Invalid embedding response from Google AI');
                }
            }
            
            return embeddings;
        } catch (e) {
            throw new Error(`Google Embeddings API error: ${e.message || e}`);
        }
    }
}