import { describe, expect, it } from 'vitest';
import { SmythRuntime, TLLMEvent } from 'index';
import { Conversation } from '@sre/helpers/Conversation.helper';
import { setupSRE } from '../../utils/sre';
import fs from 'fs';
import { testData } from '../../utils/test-data-manager';

setupSRE();
const TIMEOUT = 30000;
const LLM_OUTPUT_VALIDATOR = 'Yohohohooooo!';
const WORD_INCLUSION_PROMPT = `\nIMPORTANT : The response should start with "${LLM_OUTPUT_VALIDATOR}".`;

function runTestCases(model: string) {
    it(
        'runs a conversation with tool use',
        async () => {
            const spec = JSON.parse(fs.readFileSync(testData.getDataPath('AgentData/unit-tests-agent-randnum-randwords.smyth'), 'utf8'));

            const conv = new Conversation(model, spec);

            const prompt = 'What is your version number ?';

            const result = await conv.prompt(prompt);

            expect(result).toBeDefined();
            expect(result).toContain('v1.0.5'); // This version number is hardcoded in the skill, if the correct version is returned it means that the agent called the skill correctly
        },
        TIMEOUT
    );

    it(
        'runs a conversation with tool use in stream mode',
        async () => {
            const spec = JSON.parse(fs.readFileSync(testData.getDataPath('AgentData/unit-tests-agent-randnum-randwords.smyth'), 'utf8'));
            const conv = new Conversation(model, spec);

            let streamResult = '';

            // * The order is important to ensure proper event handling:
            // 1. Set up event listeners before calling streamPrompt to capture all events. ie. const streamComplete = new Promise<string>((resolve) => {...
            // 2. Call streamPrompt to initiate the streaming process. ie. const result = await conv.streamPrompt(...);
            // 3. Wait for the stream to complete to ensure all content is received. ie. await streamComplete;
            const streamComplete = new Promise<string>((resolve) => {
                conv.on(TLLMEvent.Content, (content) => {
                    streamResult += content;
                });
                conv.on(TLLMEvent.End, resolve);
            });

            const prompt = 'What is your version number ?';

            const result = await conv.streamPrompt(prompt);

            await streamComplete;

            expect(result).toBeDefined();
            expect(streamResult).toBeTruthy();
            expect(streamResult).toContain('v1.0.5'); // This version number is hardcoded in the skill, if the correct version is returned it means that the agent called the skill correctly
        },
        TIMEOUT
    );

    it(
        'handles multiple tool calls in a single conversation',
        async () => {
            const spec = JSON.parse(fs.readFileSync(testData.getDataPath('AgentData/unit-tests-agent-randnum-randwords.smyth'), 'utf8'));
            const conv = new Conversation(model, spec);

            let streamResult = '';

            // * The order is important to ensure proper event handling:
            // 1. Set up event listeners before calling streamPrompt to capture all events. ie. const streamComplete = new Promise<string>((resolve) => {...
            // 2. Call streamPrompt to initiate the streaming process. ie. const result = await conv.streamPrompt(...);
            // 3. Wait for the stream to complete to ensure all content is received. ie. await streamComplete;
            const streamComplete = new Promise<string>((resolve) => {
                conv.on(TLLMEvent.Content, (content) => {
                    streamResult += content;
                });
                conv.on(TLLMEvent.End, resolve);
            });

            const prompt =
                "First, Generate a random number between 42 and 100, then generate 5 keywords about The Hitchhiker's Guide to the Galaxy" +
                WORD_INCLUSION_PROMPT;

            const result = await conv.streamPrompt(prompt);

            await streamComplete;

            expect(result).toBeTruthy();
            expect(streamResult).toBeTruthy();
            expect(streamResult).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT * 2
    );

    it(
        'handles follow-up questions correctly',
        async () => {
            const spec = JSON.parse(fs.readFileSync(testData.getDataPath('AgentData/unit-tests-agent-randnum-randwords.smyth'), 'utf8'));
            const conv = new Conversation(model, spec);

            const prompt = 'What is your version number ?' + WORD_INCLUSION_PROMPT;

            await conv.prompt(prompt);

            const followUpPrompt = "Generate 5 keywords about The Hitchhiker's Guide to the Galaxy" + WORD_INCLUSION_PROMPT;
            const followUpResult = await conv.prompt(followUpPrompt);

            expect(followUpResult).toBeTruthy();
            expect(followUpResult).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT * 2
    );
}

const models = [
    { provider: 'OpenAI', id: 'gpt-4o-mini' },
    { provider: 'Anthropic', id: 'claude-3.5-haiku' },
    { provider: 'GoogleAI', id: 'gemini-1.5-flash' },
    /* { provider: 'Groq', id: 'gemma2-9b-it' },
    { provider: 'TogetherAI', id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' }, */
];

for (const model of models) {
    describe(`Conversation Tests: ${model.provider} (${model.id})`, async () => {
        await runTestCases(model.id);
    });
}
