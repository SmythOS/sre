// prettier-ignore-file
/**
 * LLM file attachments integration — requires OPENAI_API_KEY.
 * Tests image/file attachments with vision models.
 */
import { describe, it, expect } from 'vitest';
import { LLM } from '../../../src';
import { HAS_OPENAI } from '../_helpers';

describe.skipIf(!HAS_OPENAI)('INT LLM - attachments', () => {
    it('accepts a local file attachment', async () => {
        const llm = LLM.OpenAI('gpt-4o-mini');
        const res = await llm.prompt('Describe this image briefly', {
            files: ['./packages/sdk/tests/data/images/the-starry-night-mini.png'],
        });
        expect(res).toBeDefined();
        expect(res.length).toBeGreaterThan(20);
    }, 60000);

    it('accepts multiple local file attachments', async () => {
        const llm = LLM.OpenAI('gpt-4o-mini');
        const res = await llm.prompt('Describe these images briefly', {
            files: [
                './packages/sdk/tests/data/images/the-starry-night-mini.png',
                './packages/sdk/tests/data/images/the-starry-night.jpg',
            ],
        });
        expect(res).toBeDefined();
        expect(res.length).toBeGreaterThan(20);
    }, 60000);
});
