import { describe, expect, it } from 'vitest';

const run =
    process.env.OPENROUTER_API_KEY &&
    process.env.ANTHROPIC_API_KEY &&
    (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY)
        ? it
        : it.skip;
import { Conversation } from '@sre/helpers/Conversation.helper';
import { setupSRE } from '../../utils/sre';
import { models as LLM_MODELS } from '@sre/LLMManager/models';
import { Logger } from '@sre/helpers/Log.helper';

const models = {
    'gpt-4o-mini': LLM_MODELS['gpt-4o-mini'],
    'claude-3-5-haiku-latest': LLM_MODELS['claude-3-5-haiku-latest'],
    'gemini-1.5-flash': LLM_MODELS['gemini-1.5-flash'],
};
const logger = Logger('conversation.test');

setupSRE({
    ModelsProvider: {
        Connector: 'JSONModelsProvider',
    },

    Log: {
        Connector: 'ConsoleLog',
    },
});
logger.info('starting Conversation tests');

const TIMEOUT = 120_000;
const LLM_OUTPUT_VALIDATOR = 'Yohohohooooo!';
const WORD_INCLUSION_PROMPT = `\nThe response must includes "${LLM_OUTPUT_VALIDATOR}".`;

describe.each(Object.keys(models))('Conversation Tests: %s', (id: string) => {
    run(
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
        TIMEOUT
    );

    run(
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
        TIMEOUT * 10
    );

    run(
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
        TIMEOUT * 2
    );

    run(
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
        TIMEOUT * 2
    );

    describe('Passthrough Mode', () => {
        run(
            'should passthrough responses immediately midst agent execution',
            async () => {
                const conv = new Conversation(id, 'passthrough-llm-test');

                const prompt = 'Generate story with first name as John. call the endpoint /passthrough_story';

                const WAIT_THRESHOLD_SEC = 20;
                const TOTAL_AGENT_EXECUTION_TIME = 500;
                let executionTimeSec = process.hrtime();
                conv.streamPrompt(prompt);

                let error = null;
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

                    conv.on('error', (err) => {
                        error = err;
                        clearTimeout(timeout);
                        resolve(false);
                    });
                });

                if (isResponseEmitted) {
                    console.log(`Benchmark took ${executionTimeSec[0] + executionTimeSec[1] / 1e9} seconds`);
                }
                expect(error, error).toBeFalsy();
                expect(isResponseEmitted).toBe(true);
            },
            TIMEOUT * 2
        );
    });
});
