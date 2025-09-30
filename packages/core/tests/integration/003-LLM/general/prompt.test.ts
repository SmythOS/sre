import fs from 'fs';
import { describe, expect, it, beforeEach } from 'vitest';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

import { TLLMMessageRole } from '@sre/types/LLM.types';
import { setupSRE } from '../../../utils/sre';
import { testData, checkIntegrationTestConsent } from '../../../utils/test-data-manager';
checkIntegrationTestConsent();
setupSRE();

const agentId = 'cm0zjhkzx0dfvhxf81u76taiz';

const TIMEOUT = 30000;
const LLM_OUTPUT_VALIDATOR = 'Yohohohooooo!';
const WORD_INCLUSION_PROMPT = `\nAll your responses response must includes "${LLM_OUTPUT_VALIDATOR}". If the response is JSON, then include an additional key-value pair with key as "${LLM_OUTPUT_VALIDATOR}" and value as "${LLM_OUTPUT_VALIDATOR}"\n\n`;

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
            const prompt = WORD_INCLUSION_PROMPT + 'Hello, what is the smallest country in the world?';
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
            const prompt = 'What can you do?';

            const consistentMessages = [
                { role: TLLMMessageRole.System, content: 'You are a helpful assistant' + WORD_INCLUSION_PROMPT },
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
            let longPrompt = WORD_INCLUSION_PROMPT + fs.readFileSync(testData.getDataPath('dummy-article.txt'), 'utf8');
            longPrompt += '\n\nWhat is the main topic of this article?';

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
            const specialCharsPrompt = WORD_INCLUSION_PROMPT + 'Hello! こんにちは! 你好! مرحبا! 🌍🚀';
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
            const codePrompt = WORD_INCLUSION_PROMPT + 'Explain this code:\n\nfunction add(a, b) {\n  return a + b;\n}';
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

import testModels from './testModels';

for (const model of testModels) {
    describe(`LLM Prompt Tests: ${model.provider} (${model.id})`, async () => {
        await runTestCases(model.id);
    });
}
