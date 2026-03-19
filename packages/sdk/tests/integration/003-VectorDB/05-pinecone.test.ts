// prettier-ignore-file
/**
 * VectorDB - Pinecone integration.
 * Requires: PINECONE_API_KEY, PINECONE_INDEX, and OPENAI_API_KEY (for embeddings).
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { VectorDB, Model } from '../../../src/index';
import { initSRE, unique, HAS_PINECONE, HAS_OPENAI } from '../_helpers';

const CAN_RUN = HAS_PINECONE && HAS_OPENAI;

describe.skipIf(!CAN_RUN)('VectorDB - Pinecone', () => {
    beforeAll(() => initSRE());

    it('insert and search via Pinecone', async () => {
        const ns = unique('pine');
        const embeddings = Model.OpenAI('text-embedding-3-large');
        const vec = VectorDB.Pinecone(ns, {
            credentials: {
                apiKey: process.env.PINECONE_API_KEY!,
                indexName: process.env.PINECONE_INDEX!,
            },
            embeddings,
        });

        await vec.purge();
        await vec.insertDoc('pine-doc', 'Pinecone is a vector database service');

        // Pinecone indexing can take a moment
        await new Promise((r) => setTimeout(r, 3000));

        const results = await vec.search('vector database', { topK: 5 });
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].text).toBeDefined();

        // Cleanup
        await vec.deleteDoc('pine-doc');
    }, 30000);
});
