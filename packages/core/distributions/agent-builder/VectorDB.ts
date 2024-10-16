import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
/* This class implements an in-memory vector database for storing and querying data using vector embeddings.

*/
export class VectorDB {
    private vectors: Array<{ id: number; vector: number[] }>;
    private metadata: Map<number, any>;
    private idCounter: number;
    private apiKey: string;

    constructor(apiKey?: string) {
        this.vectors = [];
        this.metadata = new Map();
        this.idCounter = 0;
        this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    }

    public clear() {
        this.vectors = [];
        this.metadata = new Map();
        this.idCounter = 0;
    }
    private async getEmbedding(text: string): Promise<number[]> {
        const response = await axios.post(
            'https://api.openai.com/v1/embeddings',
            {
                model: 'text-embedding-ada-002',
                input: text,
            },
            {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data.data[0].embedding;
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        const dotProduct = a.reduce((sum, _, i) => sum + a[i] * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }

    async upsert(data: string | any, metadata?: any): Promise<number> {
        const strData = typeof data == 'string' ? data : JSON.stringify(data);
        const embedding = await this.getEmbedding(strData);
        const id = this.idCounter++;
        this.vectors.push({ id, vector: embedding });
        if (metadata) {
            this.metadata.set(id, metadata);
        }
        return id;
    }

    async search(query: string, topN: number): Promise<Array<{ id: number; score: number; metadata?: any }>> {
        const queryEmbedding = await this.getEmbedding(query);
        const results = this.vectors
            .map(({ id, vector }) => ({
                id,
                score: this.cosineSimilarity(queryEmbedding, vector),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, topN);

        return results.map(({ id, score }) => ({
            id,
            score,
            metadata: this.metadata.get(id),
        }));
    }
}
