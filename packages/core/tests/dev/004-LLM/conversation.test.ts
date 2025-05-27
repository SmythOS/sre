import { describe, expect, it } from 'vitest';
import config from '@sre/config';
import { SmythRuntime } from '@sre/index';
import { Conversation } from '@sre/helpers/Conversation.helper';
import fs from 'fs/promises';

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
    'claude-3-5-haiku-latest': {
        provider: 'Anthropic',

        llm: 'Anthropic',

        label: 'Claude 3 Haiku',
        modelId: 'claude-3-5-haiku-latest',

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
        Settings: {},
    },

    Log: {
        Connector: 'ConsoleLog',
    },
});

const TIMEOUT = 30000;
const LLM_OUTPUT_VALIDATOR = 'Yohohohooooo!';
const WORD_INCLUSION_PROMPT = `\nThe response must includes "${LLM_OUTPUT_VALIDATOR}".`;

describe.each(Object.keys(models))('Conversation Tests: %s', (id) => {
    it(
        'runs a conversation with tool use',
        async () => {
            const specUrl = 'https://clzddo5xy19zg3mjrmr3urtfd.agent.stage.smyth.ai/api-docs/openapi-llm.json';
            const system =
                `You are a helpful assistant that can answer questions about SmythOS.
                If the user asks any question, use /ask endpoint to get information and be able to answer it.` + WORD_INCLUSION_PROMPT;

            const conv = new Conversation(id, specUrl, { systemPrompt: system });

            const prompt = 'What can you help me with?';

            const result = await conv.prompt(prompt);

            expect(result).toBeTruthy();
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT,
    );

    it(
        'runs a conversation with tool use in stream mode',
        async () => {
            const specUrl = 'https://clzddo5xy19zg3mjrmr3urtfd.agent.stage.smyth.ai/api-docs/openapi-llm.json';
            const system =
                `You are a helpful assistant that can answer questions about SmythOS.
                If the user asks any question, use /ask endpoint to get information and be able to answer it.` + WORD_INCLUSION_PROMPT;
            const conv = new Conversation(id, specUrl, { systemPrompt: system });

            let streamResult = '';

            const streamComplete = new Promise<string>((resolve) => {
                conv.on('content', (content) => {
                    streamResult += content;
                });
                conv.on('end', resolve);
            });

            const prompt = 'What can you help me with?';

            const result = await conv.streamPrompt(prompt);

            await streamComplete;

            expect(result).toBeTruthy();
            expect(streamResult).toBeTruthy();
            expect(streamResult).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT,
    );

    it(
        'handles multiple tool calls in a single conversation',
        async () => {
            const specUrl = 'https://clzddo5xy19zg3mjrmr3urtfd.agent.stage.smyth.ai/api-docs/openapi-llm.json';
            const system =
                `You are a helpful assistant that can answer questions about SmythOS.
                If the user asks any question, use /ask endpoint to get information and be able to answer it.` + WORD_INCLUSION_PROMPT;
            const conv = new Conversation(id, specUrl, { systemPrompt: system });

            let streamResult = '';

            const streamComplete = new Promise<string>((resolve) => {
                conv.on('content', (content) => {
                    streamResult += content;
                });
                conv.on('end', resolve);
            });

            const prompt = 'First, tell me about SmythOS. Then, explain how it handles data storage.';

            const result = await conv.streamPrompt(prompt);

            await streamComplete;

            expect(result).toBeTruthy();
            expect(streamResult).toBeTruthy();
            expect(streamResult).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT * 2,
    );

    it(
        'handles follow-up questions correctly',
        async () => {
            const specUrl = 'https://clzddo5xy19zg3mjrmr3urtfd.agent.stage.smyth.ai/api-docs/openapi-llm.json';
            const conv = new Conversation(id, specUrl);

            const prompt = 'What is SmythOS?' + WORD_INCLUSION_PROMPT;

            await conv.prompt(prompt);

            const followUpPrompt = 'Can you provide more details about its features?' + WORD_INCLUSION_PROMPT;
            const followUpResult = await conv.prompt(followUpPrompt);

            expect(followUpResult).toBeTruthy();
            expect(followUpResult).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT * 2,
    );

    describe('Passthrough Mode', () => {
        it(
            'should passthrough responses immediately midst agent execution',
            async () => {
                const conv = new Conversation(id, 'cm7wjypk62xvk6j7vqd7np9z1');

                const prompt = 'Generate story with first name as John. call the endpoint /passthrough_story';

                const WAIT_THRESHOLD_SEC = 20;
                const TOTAL_AGENT_EXECUTION_TIME = 500;
                let executionTimeSec = process.hrtime();
                conv.streamPrompt(prompt);

                const isResponseEmitted = await new Promise((resolve) => {
                    let timeout = setTimeout(() => {
                        resolve(false);
                    }, WAIT_THRESHOLD_SEC * 1000);

                    conv.on('content', (content) => {
                        console.log('content', content);
                        clearTimeout(timeout);
                        resolve(true);
                        executionTimeSec = process.hrtime(executionTimeSec);
                    });
                });

                if (isResponseEmitted) {
                    console.log(`Benchmark took ${executionTimeSec[0] + executionTimeSec[1] / 1e9} seconds`);
                }
                expect(isResponseEmitted).toBe(true);
            },
            TIMEOUT * 2,
        );
    });
});
