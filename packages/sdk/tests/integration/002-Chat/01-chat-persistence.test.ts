// prettier-ignore-file
/**
 * Chat integration — requires a real LLM (Echo doesn't support chat context).
 * Skipped if no API keys are available.
 *
 * NOTE: Echo LLM's chat() fails with "Cannot read _context.addUserMessage"
 * because the Conversation helper needs a real LLM context.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Agent, LLM } from '../../../src/index';
import { initSRE, unique, HAS_ANY_LLM, getAnyLLMConfig } from '../_helpers';

describe.skipIf(!HAS_ANY_LLM)('Chat - Real LLM', () => {
    beforeAll(() => initSRE());

    it('creates a chat and exchanges messages', async () => {
        const config = getAnyLLMConfig()!;
        const llm = (LLM as any)[config.provider](config.model);
        const chat = llm.chat();
        expect(chat.id).toBeDefined();

        const r1 = await chat.prompt('Say just the word "hello"');
        expect(typeof r1).toBe('string');
        expect(r1.length).toBeGreaterThan(0);
    });

    it('chat retains memory across turns', async () => {
        const config = getAnyLLMConfig()!;
        const llm = (LLM as any)[config.provider](config.model);
        const chat = llm.chat();

        await chat.prompt('My name is IntegrationTestUser99.');
        const r2 = await chat.prompt('What is my name? Reply with just the name.');
        expect(r2).toContain('IntegrationTestUser99');
    });

    it('chat.prompt().stream() emits events', async () => {
        const config = getAnyLLMConfig()!;
        const llm = (LLM as any)[config.provider](config.model);
        const chat = llm.chat();
        const emitter = await chat.prompt('Say hello in one word').stream();

        let chunks = '';
        let ended = false;
        await new Promise<void>((resolve) => {
            emitter.on('content', (c: string) => { chunks += c; });
            emitter.on('end', () => { ended = true; resolve(); });
            emitter.on('error', () => resolve());
            setTimeout(() => resolve(), 30000);
        });

        expect(ended).toBe(true);
        expect(chunks.length).toBeGreaterThan(0);
    });
});
