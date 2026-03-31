// prettier-ignore-file
/**
 * VectorDB - Milvus integration.
 * Requires: MILVUS_ADDRESS (and optionally MILVUS_TOKEN or MILVUS_USER/MILVUS_PASSWORD).
 * Also requires OPENAI_API_KEY or GOOGLE_AI_API_KEY for embeddings.
 *
 * Env vars:
 *   MILVUS_ADDRESS    — e.g. "localhost:19530" or "https://in01-xxx.aws.milvuscloud.com:19530"
 *   MILVUS_TOKEN      — API token (for Zilliz Cloud / managed Milvus)
 *   MILVUS_USER       — username (alternative to token)
 *   MILVUS_PASSWORD   — password (alternative to token)
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { VectorDB, Model } from '../../../src/index';
import { initSRE, unique, HAS_MILVUS, HAS_EMBEDDINGS } from '../_helpers';

const CAN_RUN = HAS_MILVUS && HAS_EMBEDDINGS;

function milvusCredentials() {
    if (process.env.MILVUS_TOKEN) {
        return { address: process.env.MILVUS_ADDRESS!, token: process.env.MILVUS_TOKEN };
    }
    return {
        address: process.env.MILVUS_ADDRESS!,
        user: process.env.MILVUS_USER || '',
        password: process.env.MILVUS_PASSWORD || '',
    };
}

describe.skipIf(!CAN_RUN)('VectorDB - Milvus', () => {
    beforeAll(() => initSRE());

    it('insert and search via Milvus', async () => {
        const ns = unique('milvus');
        const vec = VectorDB.Milvus(ns, {
            credentials: milvusCredentials(),
        });

        await vec.purge();
        await vec.insertDoc('milvus-doc', 'Milvus is an open-source vector database');

        const results = await vec.search('vector database', { topK: 5 });
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].text).toBeDefined();

        // Cleanup
        await vec.deleteDoc('milvus-doc');
    }, 30000);

    it('insert, update, and delete a doc', async () => {
        const ns = unique('milvus');
        const vec = VectorDB.Milvus(ns, {
            credentials: milvusCredentials(),
        });

        await vec.purge();
        await vec.insertDoc('crud-doc', 'Initial content about databases');

        const r1 = await vec.search('databases', { topK: 5 });
        expect(r1.length).toBeGreaterThan(0);

        await vec.updateDoc('crud-doc', 'Updated content about machine learning');

        const r2 = await vec.search('machine learning', { topK: 5 });
        expect(r2.length).toBeGreaterThan(0);

        const deleted = await vec.deleteDoc('crud-doc');
        expect(deleted).toBe(true);
    }, 30000);

    it('agent-scoped Milvus isolates data', async () => {
        const { Agent, Model: M } = await import('../../../src/index');
        const teamId = unique('team');
        const agentA = new Agent({ id: unique('a'), teamId, name: 'A', model: M.Echo('Echo') });
        const agentB = new Agent({ id: unique('b'), teamId, name: 'B', model: M.Echo('Echo') });

        const ns = unique('milvus');
        const vecA = agentA.vectorDB.Milvus(ns, { credentials: milvusCredentials() });
        const vecB = agentB.vectorDB.Milvus(ns, { credentials: milvusCredentials() });

        await vecA.purge();
        await vecA.insertDoc('scoped-doc', 'Agent A private data');

        const aResults = await vecA.search('private');
        const bResults = await vecB.search('private');

        expect(aResults.length).toBeGreaterThan(0);
        expect(bResults.length).toBe(0);

        // Cleanup
        await vecA.deleteDoc('scoped-doc');
    }, 30000);
});
