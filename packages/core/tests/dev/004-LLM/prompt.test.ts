import fs from 'fs';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import config from '@sre/config';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { Agent } from '@sre/AgentManager/Agent.class';
import { TLLMMessageRole } from '@sre/types/LLM.types';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
// Mock Agent class to keep the test isolated from the actual Agent implementation
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => {
        // Inherit Agent.prototype for proper instanceof Agent checks
        return Object.create(Agent.prototype, {
            id: { value: 'cm0zjhkzx0dfvhxf81u76taiz' },
            teamId: { value: 'cloilcrl9001v9tkguilsu8dx' },
        });
    });
    return { Agent: MockedAgent };
});

// const models = [
//     { provider: 'OpenAI', id: 'gpt-4o-mini-2024-07-18' },
//     { provider: 'Anthropic', id: 'claude-3-haiku-20240307' },
//     { provider: 'GoogleAI', id: 'gemini-1.5-flash' },
//     { provider: 'Groq', id: 'gemma2-9b-it' },
//     { provider: 'TogetherAI', id: 'meta-llama/Meta-Llama-3-8B-Instruct-Lite' },
//     { provider: 'xAI', id: 'grok-beta' },
// ];

const models = {
    'gpt-4o-mini': {
        provider: 'OpenAI',

        llm: 'OpenAI',
        modelId: 'gpt-4o-mini-2024-07-18',
        tokens: 128_000,
        completionTokens: 16_383,
        enabled: true,
        credentials: 'internal',
    },
    'claude-3-haiku': {
        provider: 'Anthropic',

        llm: 'Anthropic',

        label: 'Claude 3 Haiku',
        modelId: 'claude-3-haiku-20240307',

        tokens: 200_000,
        completionTokens: 4096,
        enabled: true,

        credentials: 'internal',
    },
    'gemini-1.5-flash': {
        provider: 'GoogleAI',

        llm: 'GoogleAI',

        modelId: 'gemini-1.5-flash-latest',

        tokens: 1_048_576,
        completionTokens: 8192,
        enabled: true,

        credentials: 'internal',
    },
};

const sre = SmythRuntime.Instance.init({
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: process.env.AWS_S3_BUCKET_NAME || '',
            region: process.env.AWS_S3_REGION || '',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
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
    ModelsProvider: {
        Connector: 'SmythModelsProvider',
        Settings: {
            models,
        },
    },
    Account: {
        Connector: 'DummyAccount',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
        },
    },
});

// @ts-ignore (Ignore required arguments, as we are using the mocked Agent)
let agent = new Agent();

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

    const llmInference: LLMInference = await LLMInference.getInstance(model, AccessCandidate.agent(agent.id));

    it(
        `runs a simple prompt with Model: ${model}`,
        async () => {
            const prompt = 'Hello, what is the smallest country in the world?' + WORD_INCLUSION_PROMPT;
            const result: any = await llmInference.promptRequest(prompt, config, agent);

            expect(result).toBeTruthy();
            expect(result).toBeTypeOf('object');
            expect(JSON.stringify(result)).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT,
    );

    it(
        `runs a prompt with system message with Model: ${model}`,
        async () => {
            const prompt = 'What can you do?' + WORD_INCLUSION_PROMPT;

            const consistentMessages = llmInference.connector.getConsistentMessages([
                { role: TLLMMessageRole.System, content: 'You are a helpful assistant' },
                { role: TLLMMessageRole.User, content: prompt },
            ]);

            const result = await llmInference.promptRequest('', config, agent, {
                messages: consistentMessages,
            });
            expect(result).toBeTruthy();
            expect(result).toBeTypeOf('object');
            expect(JSON.stringify(result)).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT,
    );

    it(
        `handles long prompts correctly with Model: ${model}`,
        async () => {
            let longPrompt = fs.readFileSync('./tests/data/dummy-article.txt', 'utf8');
            longPrompt += '\n\nWhat is the main topic of this article?' + WORD_INCLUSION_PROMPT;

            const result = await llmInference.promptRequest(longPrompt, config, agent);
            expect(result).toBeTruthy();
            expect(result).toBeTypeOf('object');
            expect(JSON.stringify(result)).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT,
    );

    it(
        `handles complex multi-turn conversations with system message for Model: ${model}`,
        async () => {
            // * Note: WORD_INCLUSION_PROMPT does not work properly here
            const messages = JSON.parse(fs.readFileSync('./tests/data/dummy-input-messages.json', 'utf8'));

            config.data.responseFormat = '';
            const result = await llmInference.promptRequest('', config, agent, { messages });
            expect(result).toBeTruthy();
            expect(result?.length).toBeGreaterThan(200);
        },
        TIMEOUT,
    );

    it(
        `correctly handles special characters and Unicode with Model: ${model}`,
        async () => {
            const specialCharsPrompt = 'Hello! こんにちは! 你好! مرحبا! 🌍🚀' + WORD_INCLUSION_PROMPT;
            const result = await llmInference.promptRequest(specialCharsPrompt, config, agent);
            expect(result).toBeTruthy();
            expect(result).toBeTypeOf('object');
            expect(JSON.stringify(result)).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT,
    );

    it(
        `handles prompts with code snippets correctly with Model: ${model}`,
        async () => {
            const codePrompt = 'Explain this code:\n\nfunction add(a, b) {\n  return a + b;\n}' + WORD_INCLUSION_PROMPT;
            const result = await llmInference.promptRequest(codePrompt, config, agent);
            expect(result).toBeTruthy();
            expect(result).toBeTypeOf('object');
            expect(JSON.stringify(result)).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT,
    );

    it(
        `handles errors gracefully with Model: ${model}`,
        async () => {
            await expect(llmInference.promptRequest('', config, agent)).rejects.toThrow();
        },
        TIMEOUT,
    );
}

for (const model of Object.keys(models)) {
    describe(`LLM Prompt Tests: ${model}`, async () => {
        await runTestCases(model);
    });
}
