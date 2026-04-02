// prettier-ignore-file
/**
 * LLM prompt integration — requires OPENAI_API_KEY.
 */
import { describe, it, expect } from 'vitest';
import { LLM } from '../../../src';
import { HAS_OPENAI } from '../_helpers';

describe.skipIf(!HAS_OPENAI)('INT LLM - prompt', () => {
    it('OpenAI one-shot prompt returns an answer about France', async () => {
        const llm = LLM.OpenAI('gpt-4o-mini');
        const result = await llm.prompt('What is the capital of France? Reply with just the city name.');
        expect(result).toBeDefined();
        expect(result.toLowerCase()).toContain('paris');
    });
});
