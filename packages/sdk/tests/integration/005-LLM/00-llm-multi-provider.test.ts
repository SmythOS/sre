// prettier-ignore-file
/**
 * Multi-provider LLM integration tests.
 * Each provider's tests skip gracefully when its API key is missing.
 *
 * Required env vars (or vault keys):
 *   OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY,
 *   GROQ_API_KEY, XAI_API_KEY, DEEPSEEK_API_KEY,
 *   TOGETHER_AI_API_KEY, PERPLEXITY_API_KEY
 */
import { describe, it, expect } from 'vitest';
import { LLM } from '../../../src/index';
import {
    HAS_OPENAI, HAS_ANTHROPIC, HAS_GOOGLE_AI, HAS_GROQ,
    HAS_XAI, HAS_DEEPSEEK, HAS_TOGETHER_AI, HAS_PERPLEXITY,
} from '../_helpers';

// ── OpenAI ──────────────────────────────────────────────────────────────────

describe.skipIf(!HAS_OPENAI)('LLM - OpenAI', () => {
    it('prompt with gpt-4o-mini', async () => {
        const llm = LLM.OpenAI('gpt-4o-mini');
        const result = await llm.prompt('What is 2+2? Reply with just the number.');
        expect(result).toBeDefined();
        expect(result).toContain('4');
    });

    it('streaming with gpt-4o-mini', async () => {
        const llm = LLM.OpenAI('gpt-4o-mini');
        const stream = await llm.prompt('Say hello in one word').stream();

        let content = '';
        await new Promise<void>((resolve, reject) => {
            stream.on('content', (c: string) => { content += c; });
            stream.on('end', () => resolve());
            stream.on('error', reject);
        });
        expect(content.length).toBeGreaterThan(0);
    });

    it('chat memory across turns', async () => {
        const llm = LLM.OpenAI('gpt-4o-mini');
        const chat = llm.chat();
        await chat.prompt('My name is TestUser123.');
        const r2 = await chat.prompt('What is my name?');
        expect(r2).toContain('TestUser123');
    });

    it('behavior override', async () => {
        const llm = LLM.OpenAI('gpt-4o-mini', {
            behavior: 'Always start your response with [BOT]',
        });
        const result = await llm.prompt('Hi');
        expect(result).toContain('[BOT]');
    });
});

// ── Anthropic ───────────────────────────────────────────────────────────────

describe.skipIf(!HAS_ANTHROPIC)('LLM - Anthropic', () => {
    it('prompt with claude', async () => {
        const llm = LLM.Anthropic('claude-sonnet-4-20250514');
        const result = await llm.prompt('What is 2+2? Reply with just the number.');
        expect(result).toContain('4');
    });

    it('streaming with claude', async () => {
        const llm = LLM.Anthropic('claude-sonnet-4-20250514');
        const stream = await llm.prompt('Say hello in one word').stream();

        let content = '';
        await new Promise<void>((resolve, reject) => {
            stream.on('content', (c: string) => { content += c; });
            stream.on('end', () => resolve());
            stream.on('error', reject);
        });
        expect(content.length).toBeGreaterThan(0);
    });

    it('chat memory', async () => {
        const llm = LLM.Anthropic('claude-sonnet-4-20250514');
        const chat = llm.chat();
        await chat.prompt('My name is TestUser456.');
        const r2 = await chat.prompt('What is my name?');
        expect(r2).toContain('TestUser456');
    });
});

// ── Google AI ───────────────────────────────────────────────────────────────

describe.skipIf(!HAS_GOOGLE_AI)('LLM - Google AI', () => {
    it('prompt with gemini', async () => {
        const llm = LLM.GoogleAI('gemini-2.0-flash');
        const result = await llm.prompt('What is 2+2? Reply with just the number.');
        expect(result).toContain('4');
    });

    it('streaming with gemini', async () => {
        const llm = LLM.GoogleAI('gemini-2.0-flash');
        const stream = await llm.prompt('Say hello in one word').stream();

        let content = '';
        await new Promise<void>((resolve, reject) => {
            stream.on('content', (c: string) => { content += c; });
            stream.on('end', () => resolve());
            stream.on('error', reject);
        });
        expect(content.length).toBeGreaterThan(0);
    });
});

// ── Groq ────────────────────────────────────────────────────────────────────

describe.skipIf(!HAS_GROQ)('LLM - Groq', () => {
    it('prompt with llama', async () => {
        const llm = LLM.Groq('llama-3.1-8b-instant');
        const result = await llm.prompt('What is 2+2? Reply with just the number.');
        expect(result).toContain('4');
    });

    it('streaming with llama', async () => {
        const llm = LLM.Groq('llama-3.1-8b-instant');
        const stream = await llm.prompt('Say hello').stream();

        let content = '';
        await new Promise<void>((resolve, reject) => {
            stream.on('content', (c: string) => { content += c; });
            stream.on('end', () => resolve());
            stream.on('error', reject);
        });
        expect(content.length).toBeGreaterThan(0);
    });
});

// ── xAI ─────────────────────────────────────────────────────────────────────

describe.skipIf(!HAS_XAI)('LLM - xAI', () => {
    it('prompt with grok', async () => {
        const llm = LLM.xAI('grok-3-mini-fast');
        const result = await llm.prompt('What is 2+2? Reply with just the number.');
        expect(result).toContain('4');
    });
});

// ── DeepSeek ────────────────────────────────────────────────────────────────

describe.skipIf(!HAS_DEEPSEEK)('LLM - DeepSeek', () => {
    it('prompt with deepseek-chat', async () => {
        const llm = LLM.DeepSeek('deepseek-chat');
        const result = await llm.prompt('What is 2+2? Reply with just the number.');
        expect(result).toContain('4');
    });
});

// ── Together AI ─────────────────────────────────────────────────────────────

describe.skipIf(!HAS_TOGETHER_AI)('LLM - Together AI', () => {
    it('prompt with meta-llama', async () => {
        const llm = LLM.TogetherAI('meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo');
        const result = await llm.prompt('What is 2+2? Reply with just the number.');
        expect(result).toContain('4');
    });
});

// ── Perplexity ──────────────────────────────────────────────────────────────

describe.skipIf(!HAS_PERPLEXITY)('LLM - Perplexity', () => {
    it('prompt with sonar', async () => {
        const llm = LLM.Perplexity('sonar');
        const result = await llm.prompt('What is 2+2? Reply with just the number.');
        expect(result).toContain('4');
    });
});
