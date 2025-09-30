// prettier-ignore-file
import { describe, it, expect } from 'vitest';

import { LLM } from '../../../src';

// These tests hit real LLMs. Ensure your vault/API keys are configured.
// You can set explicit apiKey for local runs, e.g. LLM.OpenAI({ model: 'gpt-4o', apiKey: process.env.OPENAI_API_KEY })

describe('INT LLM - prompt', () => {
    it('OpenAI one-shot prompt returns an answer about France', async () => {
        const llm = LLM.OpenAI({ model: 'gpt-4o' });
        const result = await llm.prompt('What is the capital of France?');
        expect(result).toBeDefined();
        expect(result.toLowerCase()).toContain('paris');
    });
});
