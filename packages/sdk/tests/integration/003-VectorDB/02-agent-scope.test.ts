// prettier-ignore-file
/**
 * VectorDB agent scope isolation.
 * Requires OPENAI_API_KEY or GOOGLE_AI_API_KEY (RAMVec uses embeddings).
 * TEAM scope test additionally requires OpenAI for text-embedding-3-large.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Agent, Model, Scope } from '../../../src/index';
import { initSRE, unique, HAS_EMBEDDINGS, HAS_OPENAI } from '../_helpers';

describe.skipIf(!HAS_EMBEDDINGS)('VectorDB - Agent scope isolation vs Team sharing', () => {
    beforeAll(() => initSRE());

    it('isolates data between agents by default', async () => {
        const teamId = unique('team');
        const agentA = new Agent({ id: unique('agentA'), teamId, name: 'A', model: Model.Echo('Echo') });
        const agentB = new Agent({ id: unique('agentB'), teamId, name: 'B', model: Model.Echo('Echo') });

        const ns = unique('ns');
        const vecA = agentA.vectorDB.RAMVec(ns);
        const vecB = agentB.vectorDB.RAMVec(ns);

        await vecA.purge();
        await vecA.insertDoc('doc', 'Secret A');

        const aResults = await vecA.search('Secret');
        const bResults = await vecB.search('Secret');

        expect(aResults.length).toBeGreaterThan(0);
        expect(bResults.length).toBe(0);
    });

    it.skipIf(!HAS_OPENAI)('shares data when scope is TEAM (requires OpenAI embeddings)', async () => {
        const teamId = unique('team');
        const agentA = new Agent({ id: unique('agentA'), teamId, name: 'A', model: Model.Echo('Echo') });
        const agentB = new Agent({ id: unique('agentB'), teamId, name: 'B', model: Model.Echo('Echo') });

        const ns = unique('ns');
        const embeddings = Model.OpenAI('text-embedding-3-large');
        const vecA = agentA.vectorDB.RAMVec(ns, { scope: Scope.TEAM, embeddings });
        const vecB = agentB.vectorDB.RAMVec(ns, { scope: Scope.TEAM, embeddings });

        await vecA.purge();
        await vecA.insertDoc('doc-team', 'Shared');

        const aResults = await vecA.search('Shared');
        const bResults = await vecB.search('Shared');

        expect(aResults.length).toBeGreaterThan(0);
        expect(bResults.length).toBeGreaterThan(0);
    });
});
