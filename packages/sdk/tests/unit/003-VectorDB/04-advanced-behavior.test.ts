// prettier-ignore-file
import { describe, it, beforeAll, expect } from 'vitest';
import { SRE } from '@smythos/sre';
import { Agent, Doc, TParsedDocument } from '../../../src/index';

function unique(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe('VectorDB - Advanced behavior', () => {
    beforeAll(async () => {
        SRE.init({});
        await SRE.ready();
    });

    it('parses structured doc and indexes multiple pages', async () => {
        const agent = new Agent({ id: unique('agent'), teamId: unique('team'), name: 'A', model: 'gpt-4o' });
        const ns = unique('ns');
        const vec = agent.vectorDB.RAMVec(ns);

        // simple synthetic parsed doc with two pages
        const parsed: TParsedDocument = {
            title: 'Sample',
            metadata: { author: 'Tester', uri: '', date: '2021-01-01', tags: [] },
            pages: [
                {
                    metadata: { pageNumber: 1 },
                    content: [{ type: 'text', data: 'First page text about vectors', text: 'First page text about vectors' }],
                },
                {
                    metadata: { pageNumber: 2 },
                    content: [{ type: 'text', data: 'Second page mentions embeddings', text: 'Second page mentions embeddings' }],
                },
            ],
        };

        await vec.purge();
        await vec.insertDoc(parsed.title, parsed, { source: 'unit' });

        const r1 = await vec.search('vectors');
        const r2 = await vec.search('embeddings');
        expect(r1.length).toBeGreaterThan(0);
        expect(r2.length).toBeGreaterThan(0);
    });
});
