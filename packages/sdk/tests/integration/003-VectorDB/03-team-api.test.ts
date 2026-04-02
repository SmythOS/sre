// prettier-ignore-file
/**
 * VectorDB - Team API.
 * Requires OPENAI_API_KEY or GOOGLE_AI_API_KEY (RAMVec uses embeddings).
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Team } from '../../../src/index';
import { initSRE, unique, HAS_EMBEDDINGS } from '../_helpers';

describe.skipIf(!HAS_EMBEDDINGS)('VectorDB - Team API', () => {
    beforeAll(() => initSRE());

    it('team.vectorDB.RAMVec works and isolates per team', async () => {
        const teamA = new Team(unique('teamA'));
        const teamB = new Team(unique('teamB'));

        const ns = unique('ns');
        const vecA = teamA.vectorDB.RAMVec(ns);
        const vecB = teamB.vectorDB.RAMVec(ns);

        await vecA.purge();
        await vecA.insertDoc('hello', 'Hello from A');

        const aResults = await vecA.search('Hello');
        const bResults = await vecB.search('Hello');

        expect(aResults.length).toBeGreaterThan(0);
        expect(bResults.length).toBe(0);
    });
});
