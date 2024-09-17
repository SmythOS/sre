import fs from 'fs';
import { describe, expect, it, vi } from 'vitest';
import config from '@sre/config';
import { SmythRuntime } from '@sre/index';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import Agent from '@sre/AgentManager/Agent.class';

// Mock Agent class to keep the test isolated from the actual Agent implementation
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => {
        // Inherit Agent.prototype for proper instanceof Agent checks
        return Object.create(Agent.prototype, {
            id: { value: 1 },
        });
    });
    return { default: MockedAgent };
});

const sre = SmythRuntime.Instance.init({
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: config.env.AWS_S3_BUCKET_NAME || '',
            region: config.env.AWS_S3_REGION || '',
            accessKeyId: config.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: config.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
    AgentData: {
        Connector: 'Local',
        Settings: {
            devDir: './tests/data/AgentData',
            prodDir: './tests/data/AgentData',
        },
    },
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './tests/data/vault.json',
        },
    },
});

// @ts-ignore (Ignore required arguments, as we are using the mocked Agent)
let agent = new Agent();

const TIMEOUT = 30000;

function runTestCases(model: string) {
    const config = {
        data: {
            model,
            maxTokens: 100,
            temperature: 0.5,
            stopSequences: '<stop>',
            topP: 0.9,
            topK: 10,
            frequencyPenalty: 0.1,
            presencePenalty: 0.1,
        },
    };
    const llmHelper: LLMHelper = LLMHelper.load(model);

    function expectValidResponse(result: any) {
        expect(result).toBeDefined();
        expect(result).not.toBe('');
    }

    it(
        `runs a simple prompt with Model: ${model}`,
        async () => {
            const result: any = await llmHelper.promptRequest('Hello, how are you?', config, agent);
            expectValidResponse(result);
        },
        TIMEOUT
    );

    it(
        `runs a prompt with system message with Model: ${model}`,
        async () => {
            const result = await llmHelper.promptRequest('', config, agent, {
                messages: [
                    { role: 'system', content: 'You are a helpful assistant' },
                    { role: 'user', content: 'What can you do?' },
                ],
            });
            expectValidResponse(result);
        },
        TIMEOUT
    );

    it(
        `handles long prompts correctly with Model: ${model}`,
        async () => {
            let longPrompt = fs.readFileSync('./tests/data/dummy-article.txt', 'utf8');
            longPrompt += '\n\nWhat is the main topic of this article?';

            const result = await llmHelper.promptRequest(longPrompt, config, agent);
            expectValidResponse(result);
        },
        TIMEOUT
    );

    it(
        `handles complex multi-turn conversations with system message for Model: ${model}`,
        async () => {
            const messages = JSON.parse(fs.readFileSync('./tests/data/dummy-input-messages.json', 'utf8'));

            const result = await llmHelper.promptRequest('', config, agent, { messages });
            expectValidResponse(result);
        },
        TIMEOUT
    );

    it(
        `correctly handles special characters and Unicode with Model: ${model}`,
        async () => {
            const specialCharsPrompt = 'Hello! こんにちは! 你好! مرحبا! 🌍🚀';
            const result = await llmHelper.promptRequest(specialCharsPrompt, config, agent);
            expectValidResponse(result);
        },
        TIMEOUT
    );

    it(
        `handles prompts with code snippets correctly with Model: ${model}`,
        async () => {
            const codePrompt = 'Explain this code:\n\nfunction add(a, b) {\n  return a + b;\n}';
            const result = await llmHelper.promptRequest(codePrompt, config, agent);
            expectValidResponse(result);
        },
        TIMEOUT
    );

    it(
        `handles errors gracefully with Model: ${model}`,
        async () => {
            await expect(llmHelper.promptRequest('', config, agent)).rejects.toThrow();
        },
        TIMEOUT
    );
}

const models = [
    'gpt-4o-mini', // OpenAI
    'claude-3-5-sonnet-20240620', // Anthropic
    'gemini-1.5-flash', // Google API
    'gemma2-9b-it', // Groq
    'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', // TogetherAI
];

for (const model of models) {
    describe(`LLM Prompt Tests for Model: ${model}`, () => {
        runTestCases(model);
    });
}
