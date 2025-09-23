import fs from 'fs';
import { describe, expect, it, beforeEach } from 'vitest';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

import { TLLMMessageRole } from '@sre/types/LLM.types';
import { setupSRE } from '../../utils/sre';
import { testData } from '../../utils/test-data-manager';

setupSRE();

const agentId = 'cm0zjhkzx0dfvhxf81u76taiz';

const TIMEOUT = 30000;
const LLM_OUTPUT_VALIDATOR = 'Yohohohooooo!';
const WORD_INCLUSION_PROMPT = `\nThe response must includes "${LLM_OUTPUT_VALIDATOR}". If the response is JSON, then include an additional key-value pair with key as "${LLM_OUTPUT_VALIDATOR}" and value as "${LLM_OUTPUT_VALIDATOR}"`;

async function runTestCases(model: string) {
    let config;

    beforeEach(() => {
        config = {
            data: {
                model,
                maxTokens: 100,
                temperature: 0.5,
                stopSequences: '<stop>',
                topP: 0.9,
                topK: 10,
                frequencyPenalty: 0,
                presencePenalty: 0,
                responseFormat: 'json',
            },
        };
    });

    const llmInference: LLMInference = await LLMInference.getInstance(model, AccessCandidate.team('default'));

    it(
        `runs a simple prompt with Model: ${model}`,
        async () => {
            const prompt = 'Hello, what is the smallest country in the world?' + WORD_INCLUSION_PROMPT;
            const result: any = await llmInference.prompt({
                query: prompt,
                params: { ...config.data, agentId },
            });

            expect(result).toBeTruthy();
            expect(JSON.stringify(result)).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        `runs a prompt with system message with Model: ${model}`,
        async () => {
            const prompt = 'What can you do?' + WORD_INCLUSION_PROMPT;

            const consistentMessages = [
                { role: TLLMMessageRole.System, content: 'You are a helpful assistant' },
                { role: TLLMMessageRole.User, content: prompt },
            ];

            const result = await llmInference.prompt({
                contextWindow: consistentMessages,
                params: { ...config.data, agentId },
            });
            expect(result).toBeTruthy();
            expect(JSON.stringify(result)).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        `handles long prompts correctly with Model: ${model}`,
        async () => {
            let longPrompt = fs.readFileSync(testData.getDataPath('dummy-article.txt'), 'utf8');
            longPrompt += '\n\nWhat is the main topic of this article?' + WORD_INCLUSION_PROMPT;

            const result = await llmInference.prompt({
                query: longPrompt,
                params: { ...config.data, agentId },
            });
            expect(result).toBeTruthy();
            expect(JSON.stringify(result)).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        `handles complex multi-turn conversations with system message for Model: ${model}`,
        async () => {
            // * Note: WORD_INCLUSION_PROMPT does not work properly here
            const messages = JSON.parse(fs.readFileSync(testData.getDataPath('dummy-input-messages.json'), 'utf8'));

            config.data.responseFormat = '';
            const result = await llmInference.prompt({
                contextWindow: messages,
                params: { ...config.data, agentId },
            });
            expect(result).toBeTruthy();
            expect(result?.length).toBeGreaterThan(200);
        },
        TIMEOUT
    );

    it(
        `correctly handles special characters and Unicode with Model: ${model}`,
        async () => {
            const specialCharsPrompt = 'Hello! こんにちは! 你好! مرحبا! 🌍🚀' + WORD_INCLUSION_PROMPT;
            const result = await llmInference.prompt({
                query: specialCharsPrompt,
                params: { ...config.data, agentId },
            });
            expect(result).toBeTruthy();
            expect(JSON.stringify(result)).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        `handles prompts with code snippets correctly with Model: ${model}`,
        async () => {
            const codePrompt = 'Explain this code:\n\nfunction add(a, b) {\n  return a + b;\n}' + WORD_INCLUSION_PROMPT;
            const result = await llmInference.prompt({
                query: codePrompt,
                params: { ...config.data, agentId },
            });
            expect(result).toBeTruthy();
            expect(JSON.stringify(result)).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        `handles errors gracefully with Model: ${model}`,
        async () => {
            const result = await llmInference.prompt({ query: '', params: { ...config.data, agentId } });
            await expect(result).toBeDefined();
        },
        TIMEOUT
    );
}

const models = [
    { provider: 'OpenAI', id: 'gpt-4o-mini' },
    { provider: 'Anthropic', id: 'claude-3.5-haiku' },
    { provider: 'GoogleAI', id: 'gemini-1.5-flash' },
    { provider: 'Groq', id: 'gemma2-9b-it' },
    // { provider: 'TogetherAI', id: 'meta-llama/Meta-Llama-3-8B-Instruct-Lite' },
    // { provider: 'xAI', id: 'grok-beta' },
];

for (const model of models) {
    describe(`LLM Prompt Tests: ${model.provider} (${model.id})`, async () => {
        await runTestCases(model.id);
    });
}
