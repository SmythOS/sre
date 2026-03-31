// prettier-ignore-file
/**
 * Cross-module integration — no API keys required (except VectorDB tests).
 * Tests realistic agent workflows combining multiple services.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Agent, Model, Doc, VectorDB } from '../../../src/index';
import { initSRE, unique, HAS_EMBEDDINGS } from '../_helpers';

describe('Cross-Module - Agent services (no API keys)', () => {
    beforeAll(() => initSRE());

    it('agent uses storage + cache together', async () => {
        const agent = new Agent({
            id: unique('fullstack'),
            name: 'FullStackBot',
            model: Model.Echo('Echo'),
        });

        // 1. Storage: write and read
        const store = agent.storage.LocalStorage();
        await store.write('notes.txt', 'Remember to test everything');
        const content = await store.read('notes.txt');
        expect(content.toString()).toBe('Remember to test everything');

        // 2. Cache: store a computed result
        const cache = agent.cache.RAM();
        await cache.set('last-run', JSON.stringify({ timestamp: Date.now(), status: 'ok' }));
        const cached = JSON.parse(await cache.get('last-run'));
        expect(cached.status).toBe('ok');

        // Cleanup
        await store.delete('notes.txt');
        await cache.delete('last-run');
    });

    it('multi-skill agent dispatches correctly', async () => {
        const agent = new Agent({
            id: unique('multi'),
            name: 'MultiBot',
            model: Model.Echo('Echo'),
        });

        const log: string[] = [];

        agent.addSkill({
            name: 'log',
            description: 'Log a message',
            process: async ({ msg }) => { log.push(msg); return 'logged'; },
        });

        agent.addSkill({
            name: 'count',
            description: 'Count log entries',
            process: async () => String(log.length),
        });

        await agent.call('log', { msg: 'first' });
        await agent.call('log', { msg: 'second' });
        const countResult = await agent.call('count', {});

        expect(log).toEqual(['first', 'second']);
        expect(countResult.data).toBe('2');
    });
});

describe.skipIf(!HAS_EMBEDDINGS)('Cross-Module - Agent + VectorDB (needs embeddings)', () => {
    beforeAll(() => initSRE());

    it('storage + cache + vectorDB full pipeline', async () => {
        const agent = new Agent({
            id: unique('full'),
            name: 'FullBot',
            model: Model.Echo('Echo'),
        });

        const store = agent.storage.LocalStorage();
        await store.write('test.txt', 'Integration test content');

        const cache = agent.cache.RAM();
        await cache.set('indexed', 'true');

        const vec = agent.vectorDB.RAMVec(unique('full-vec'));
        const parsed = await Doc.text.parse('Agent integration testing is important for quality');
        await vec.insertDoc('test-doc', parsed);
        const results = await vec.search('integration testing');
        expect(results.length).toBeGreaterThan(0);

        // Cleanup
        await store.delete('test.txt');
        await cache.delete('indexed');
    });
});
