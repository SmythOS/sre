// prettier-ignore-file
/**
 * Doc parsing + VectorDB pipeline.
 * Parsing tests (Doc.md, Doc.text) need no API keys.
 * VectorDB indexing tests require OPENAI_API_KEY or GOOGLE_AI_API_KEY.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Agent, Model, Doc, VectorDB } from '../../../src/index';
import { initSRE, unique, HAS_EMBEDDINGS } from '../_helpers';

describe('Doc Pipeline - Parsing (no API keys)', () => {
    beforeAll(() => initSRE());

    it('parse markdown extracts title and pages', async () => {
        const markdown = `# Integration Test Doc

## Section One
TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.

## Section Two
Vitest is a blazing fast unit test framework powered by Vite.
`;
        const parsed = await Doc.md.parse(markdown);
        expect(parsed.title).toBe('Integration Test Doc');
        expect(parsed.pages.length).toBeGreaterThanOrEqual(1);
    });

    it('parse plain text returns single page', async () => {
        const parsed = await Doc.text.parse('The quick brown fox jumps over the lazy dog');
        expect(parsed.pages.length).toBe(1);
    });
});

describe.skipIf(!HAS_EMBEDDINGS)('Doc Pipeline - Parse → Index → Search', () => {
    beforeAll(() => initSRE());

    it('parse markdown → insert into RAMVec → search finds content', async () => {
        const markdown = `# Integration Test Doc

## Section One
TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.

## Section Two
Vitest is a blazing fast unit test framework powered by Vite.
`;
        const parsed = await Doc.md.parse(markdown);

        const ns = unique('doc-pipeline');
        const vec = VectorDB.RAMVec(ns);
        await vec.purge();

        await vec.insertDoc('test-doc', parsed, { source: 'integration-test' });

        const results = await vec.search('TypeScript', { topK: 5 });
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].text).toBeDefined();
    });

    it('parse plain text → insert → search', async () => {
        const parsed = await Doc.text.parse('The quick brown fox jumps over the lazy dog');

        const ns = unique('text-pipeline');
        const vec = VectorDB.RAMVec(ns);
        await vec.purge();

        await vec.insertDoc('fox-doc', parsed);

        const results = await vec.search('fox', { topK: 3 });
        expect(results.length).toBeGreaterThan(0);
    });

    it('agent-scoped vectorDB with doc parsing', async () => {
        const agent = new Agent({
            id: unique('docbot'),
            name: 'DocBot',
            model: Model.Echo('Echo'),
        });
        const ns = unique('agent-doc');
        const vec = agent.vectorDB.RAMVec(ns);
        await vec.purge();

        const parsed = await Doc.md.parse('# Notes\n\nRemember to buy milk and eggs.');
        await vec.insertDoc('notes', parsed);

        const results = await vec.search('milk');
        expect(results.length).toBeGreaterThan(0);
    });
});
