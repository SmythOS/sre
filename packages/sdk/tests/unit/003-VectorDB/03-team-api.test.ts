// prettier-ignore-file
import { describe, it, beforeAll, expect } from 'vitest';
import { SRE } from '@smythos/sre';
import { Team } from '../../../src/index';

function unique(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe('VectorDB - Team API', () => {
    beforeAll(async () => {
        SRE.init({});
        await SRE.ready();
    });

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
