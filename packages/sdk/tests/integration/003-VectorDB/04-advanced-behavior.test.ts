// prettier-ignore-file
/**
 * VectorDB - Advanced behavior.
 * Requires OPENAI_API_KEY or GOOGLE_AI_API_KEY (RAMVec uses embeddings).
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Agent, Model, TParsedDocument } from '../../../src/index';
import { initSRE, unique, HAS_EMBEDDINGS } from '../_helpers';

describe.skipIf(!HAS_EMBEDDINGS)('VectorDB - Advanced behavior', () => {
    beforeAll(() => initSRE());

    it('parses structured doc and indexes multiple pages', async () => {
        const agent = new Agent({ id: unique('agent'), teamId: unique('team'), name: 'A', model: Model.Echo('Echo') });
        const ns = unique('ns');
        const vec = agent.vectorDB.RAMVec(ns);

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
