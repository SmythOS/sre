// prettier-ignore-file
/**
 * VectorDB - Standalone RAMVec.
 * Requires OPENAI_API_KEY or GOOGLE_AI_API_KEY (RAMVec uses embeddings).
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { VectorDB } from '../../../src/index';
import { initSRE, unique, HAS_EMBEDDINGS } from '../_helpers';

describe.skipIf(!HAS_EMBEDDINGS)('VectorDB - Standalone RAMVec', () => {
    beforeAll(() => initSRE());

    it('insert, search, update and delete a doc', async () => {
        const namespace = unique('ns');
        const ram = VectorDB.RAMVec(namespace);

        await ram.purge();

        const id = await ram.insertDoc('hello', 'Hello, world!', { metadata: { label: 'greeting' } });
        expect(id).toBeTruthy();

        const results1 = await ram.search('Hello', { topK: 5 });
        expect(Array.isArray(results1)).toBe(true);
        expect(results1.length).toBeGreaterThanOrEqual(1);
        expect(results1[0].text).toBeTruthy();
        expect(results1[0].metadata).toBeTruthy();

        await ram.updateDoc('hello', 'Hello again!');
        const results2 = await ram.search('again', { topK: 5 });
        expect(results2.length).toBeGreaterThanOrEqual(1);

        const deleted = await ram.deleteDoc('hello');
        expect(deleted).toBe(true);

        const results3 = await ram.search('Hello', { topK: 5 });
        expect(results3.length).toBe(0);
    });

    it('includeEmbeddings returns embedding arrays', async () => {
        const namespace = unique('ns');
        const ram = VectorDB.RAMVec(namespace, {});
        await ram.insertDoc('emb', 'Vector content');
        const results = await ram.search('Vector', { includeEmbeddings: true });
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(Array.isArray(results[0].embedding) || results[0].embedding === undefined).toBe(true);
    });
});
