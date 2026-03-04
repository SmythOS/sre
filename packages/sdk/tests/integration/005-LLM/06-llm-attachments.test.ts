// prettier-ignore-file
import { describe, it, expect } from 'vitest';

import { LLM } from '../../../src';

describe('INT LLM - attachments', () => {
    it('accepts a URL attachment', async () => {
        const llm = LLM.OpenAI({ model: 'gpt-4o' });
        const res = await llm.prompt('Describe this image in one sentence', {
            files: ['https://example.com/image.png'],
        });
        expect(res).toBeDefined();
    }, 60000);

    it('accepts a local file attachment', async () => {
        const llm = LLM.OpenAI({ model: 'gpt-4o' });
        const res = await llm.prompt('Describe this image briefly', {
            files: ['./packages/sdk/tests/data/images/the-starry-night-mini.png'],
        });
        expect(res).toBeDefined();
        expect(res.length).toBeGreaterThan(20);
    }, 60000);

    it('accepts multiple local file attachments', async () => {
        const llm = LLM.OpenAI({ model: 'gpt-4o' });
        const res = await llm.prompt('Describe these images briefly', {
            files: ['./packages/sdk/tests/data/images/the-starry-night-mini.png', './packages/sdk/tests/data/images/the-starry-night.jpg'],
        });
        expect(res).toBeDefined();
        expect(res.length).toBeGreaterThan(20);
    }, 60000);
});
