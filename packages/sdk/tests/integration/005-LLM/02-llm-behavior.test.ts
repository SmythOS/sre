// prettier-ignore-file
import { describe, it, expect } from 'vitest';

import { LLM } from '../../../src';

describe('INT LLM - behavior', () => {
    it('applies behavior from model settings', async () => {
        const llm = LLM.OpenAI('gpt-4o-mini', {
            behavior: 'You start every answer with this prompt $> ',
        });
        const result = await llm.prompt('What is the capital of France?');
        expect(result).toBeDefined();
        expect(result).toContain('$>');
    });

    it('overrides behavior via prompt options', async () => {
        const llm = LLM.OpenAI('gpt-4o-mini', {
            behavior: 'You start every answer with this prompt $> ',
        });
        const result = await llm.prompt('What is the capital of France?', {
            behavior: 'You start every answer with this prompt [AGENT]> ',
        });
        expect(result).toBeDefined();
        expect(result).toContain('[AGENT]>');
    });
});
