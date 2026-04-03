// prettier-ignore-file
/**
 * LLM streaming integration — requires OPENAI_API_KEY.
 */
import { describe, it, expect } from 'vitest';
import { LLM } from '../../../src';
import { HAS_OPENAI } from '../_helpers';

describe.skipIf(!HAS_OPENAI)('INT LLM - streaming', () => {
    it('streams content and completes', async () => {
        const llm = LLM.OpenAI('gpt-4o-mini');
        const stream = await llm.prompt('What is the capital of France? Reply with just the city name.').stream();
        let result = '';
        await new Promise<void>((resolve, reject) => {
            stream.on('content', (c: string) => {
                result += c;
            });
            stream.on('end', () => resolve());
            stream.on('error', reject);
        });
        expect(result).toBeDefined();
        expect(result.toLowerCase()).toContain('paris');
    });
});
