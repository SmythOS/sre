// prettier-ignore-file
/**
 * LLM chat memory integration — requires OPENAI_API_KEY.
 */
import { describe, it, expect } from 'vitest';
import { LLM } from '../../../src';
import { HAS_OPENAI } from '../_helpers';

describe.skipIf(!HAS_OPENAI)('INT LLM - chat memory', () => {
    it('remembers name across prompts in a chat session', async () => {
        const llm = LLM.OpenAI('gpt-4o-mini');
        const chat = llm.chat();
        const result1 = await chat.prompt('Hi my name is John Doe. What is the capital of France?');
        expect(result1).toBeDefined();
        expect(result1.toLowerCase()).toContain('paris');

        const result2 = await chat.prompt('Do you remember my name?');
        expect(result2).toBeDefined();
        expect(result2).toContain('John Doe');
    });
});
