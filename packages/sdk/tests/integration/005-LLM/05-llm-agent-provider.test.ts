// prettier-ignore-file
/**
 * Agent + real LLM provider integration.
 * Uses the first available LLM provider (OpenAI > Anthropic > GoogleAI > Groq).
 * Skipped entirely if no API keys are configured.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Agent, LLM } from '../../../src/index';
import { initSRE, unique, HAS_ANY_LLM, getAnyLLMConfig } from '../_helpers';

describe.skipIf(!HAS_ANY_LLM)('Agent + real LLM provider', () => {
    beforeAll(() => initSRE());

    it('agent.prompt() with a real LLM returns meaningful response', async () => {
        const config = getAnyLLMConfig()!;
        const model = (LLM as any)[config.provider](config.model);
        const agent = new Agent({
            id: unique('real-llm'),
            name: 'RealLLMBot',
            model,
        });
        const result = await agent.prompt('What is 2+2? Reply with just the number.');
        expect(result).toContain('4');
    });

    it('agent.chat() with real LLM maintains conversation', async () => {
        const config = getAnyLLMConfig()!;
        const model = (LLM as any)[config.provider](config.model);
        const agent = new Agent({
            id: unique('real-chat'),
            name: 'RealChatBot',
            model,
        });
        const chat = agent.chat({ persist: false });

        await chat.prompt('My secret code is ALPHA-7.');
        const r2 = await chat.prompt('What is my secret code? Reply with just the code.');
        expect(r2).toContain('ALPHA-7');
    });

    it('agent.prompt().stream() with real LLM emits content', async () => {
        const config = getAnyLLMConfig()!;
        const model = (LLM as any)[config.provider](config.model);
        const agent = new Agent({
            id: unique('real-stream'),
            name: 'StreamBot',
            model,
        });
        const stream = await agent.prompt('Say hello in one word').stream();

        let content = '';
        let ended = false;
        await new Promise<void>((resolve) => {
            stream.on('content', (c: string) => { content += c; });
            stream.on('end', () => { ended = true; resolve(); });
            stream.on('error', () => resolve());
            setTimeout(() => resolve(), 30000);
        });

        expect(ended).toBe(true);
        expect(content.length).toBeGreaterThan(0);
    });
});
