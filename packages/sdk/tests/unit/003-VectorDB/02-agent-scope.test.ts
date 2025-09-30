// prettier-ignore-file
import { describe, it, beforeAll, expect } from 'vitest';
import { SRE } from '@smythos/sre';
import { Agent, Model, Scope } from '../../../src/index';

function unique(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe('VectorDB - Agent scope isolation vs Team sharing', () => {
    beforeAll(async () => {
        SRE.init({});
        await SRE.ready();
    });

    it('isolates data between agents by default', async () => {
        const teamId = unique('team');
        const agentA = new Agent({ id: unique('agentA'), teamId, name: 'A', model: 'gpt-4o' });
        const agentB = new Agent({ id: unique('agentB'), teamId, name: 'B', model: 'gpt-4o' });

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

    it('shares data when scope is TEAM', async () => {
        const teamId = unique('team');
        const agentA = new Agent({ id: unique('agentA'), teamId, name: 'A', model: 'gpt-4o' });
        const agentB = new Agent({ id: unique('agentB'), teamId, name: 'B', model: 'gpt-4o' });

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
