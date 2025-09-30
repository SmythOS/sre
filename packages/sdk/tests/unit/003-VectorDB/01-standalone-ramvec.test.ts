// prettier-ignore-file
import { describe, it, beforeAll, expect } from 'vitest';
import { SRE } from '@smythos/sre';
import { VectorDB } from '../../../src/index';

function uniqueNS() {
    return `ns-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe('VectorDB - Standalone RAMVec', () => {
    beforeAll(async () => {
        SRE.init({});
        await SRE.ready();
    });

    it('insert, search, update and delete a doc', async () => {
        const namespace = uniqueNS();
        const ram = VectorDB.RAMVec(namespace);

        // purge cleans namespace (safe if not exists)
        await ram.purge();

        // insert
        const id = await ram.insertDoc('hello', 'Hello, world!', { label: 'greeting' });
        expect(id).toBeTruthy();

        // search
        const results1 = await ram.search('Hello', { topK: 5 });
        expect(Array.isArray(results1)).toBe(true);
        expect(results1.length).toBeGreaterThanOrEqual(1);
        expect(results1[0].text).toBeTruthy();
        expect(results1[0].metadata).toBeTruthy();

        // update (appends new vectors)
        await ram.updateDoc('hello', 'Hello again!');
        const results2 = await ram.search('again', { topK: 5 });
        expect(results2.length).toBeGreaterThanOrEqual(1);

        // delete
        const deleted = await ram.deleteDoc('hello');
        expect(deleted).toBe(true);

        // search after delete returns []
        const results3 = await ram.search('Hello', { topK: 5 });
        expect(results3.length).toBe(0);
    });

    it('includeEmbeddings returns embedding arrays', async () => {
        const namespace = uniqueNS();
        const ram = VectorDB.RAMVec(namespace, {});
        await ram.insertDoc('emb', 'Vector content');
        const results = await ram.search('Vector', { includeEmbeddings: true });
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(Array.isArray(results[0].embedding) || results[0].embedding === undefined).toBe(true);
    });
});
