import { describe, expect, it } from 'vitest';
import config from '@sre/config';
import { SmythRuntime } from '@sre/index';
import { Conversation } from '@sre/helpers/Conversation.helper';

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

const TIMEOUT = 30000;

function runTestCases(model: string) {
    describe(`Conversation Tests for Model: ${model}`, () => {
        const expectValidResponse = (result: any, length: number) => {
            expect(result).toBeTruthy();
            expect(result?.length).toBeGreaterThanOrEqual(length);
        };

        it(
            'runs a conversation with tool use',
            async () => {
                const specUrl = 'https://clzddo5xy19zg3mjrmr3urtfd.agent.stage.smyth.ai/api-docs/openapi-llm.json';
                const system = `You are a helpful assistant that can answer questions about SmythOS.
                If the user asks any question, use /ask endpoint to get information and be able to answer it.`;

                const conv = new Conversation(model, specUrl);
                conv.systemPrompt = system;

                const result = await conv.prompt('What can you help me with?');

                expectValidResponse(result, 20);
            },
            TIMEOUT
        );

        it(
            'runs a conversation with tool use in stream mode',
            async () => {
                const specUrl = 'https://clzddo5xy19zg3mjrmr3urtfd.agent.stage.smyth.ai/api-docs/openapi-llm.json';
                const system = `You are a helpful assistant that can answer questions about SmythOS.
                If the user asks any question, use /ask endpoint to get information and be able to answer it.`;
                const conv = new Conversation(model, specUrl);
                conv.systemPrompt = system;

                let streamResult = '';

                // * The order is important to ensure proper event handling:
                // 1. Set up event listeners before calling streamPrompt to capture all events. ie. const streamComplete = new Promise<string>((resolve) => {...
                // 2. Call streamPrompt to initiate the streaming process. ie. const result = await conv.streamPrompt(...);
                // 3. Wait for the stream to complete to ensure all content is received. ie. await streamComplete;
                const streamComplete = new Promise<string>((resolve) => {
                    conv.on('content', (content) => {
                        streamResult += content;
                    });
                    conv.on('end', resolve);
                });

                const result = await conv.streamPrompt('What can you help me with?');

                await streamComplete;

                expectValidResponse(result, 20);
                expectValidResponse(streamResult, 20);
            },
            TIMEOUT
        );

        // TODO [Forhad]: properly test that multiple tool calls are working as expected
        /* it(
            'handles multiple tool calls in a single conversation',
            async () => {
                const specUrl = 'https://clzddo5xy19zg3mjrmr3urtfd.agent.stage.smyth.ai/api-docs/openapi-llm.json';
                const system = `You are a helpful assistant that can answer questions about SmythOS.
                If the user asks any question, use /ask endpoint to get information and be able to answer it.`;
                const conv = new Conversation(model, specUrl);
                conv.systemPrompt = system;

                let streamResult = '';

                // * The order is important to ensure proper event handling:
                // 1. Set up event listeners before calling streamPrompt to capture all events. ie. const streamComplete = new Promise<string>((resolve) => {...
                // 2. Call streamPrompt to initiate the streaming process. ie. const result = await conv.streamPrompt(...);
                // 3. Wait for the stream to complete to ensure all content is received. ie. await streamComplete;
                const streamComplete = new Promise<string>((resolve) => {
                    conv.on('content', (content) => {
                        streamResult += content;
                    });
                    conv.on('end', resolve);
                });

                const result = await conv.streamPrompt('First, tell me about SmythOS. Then, explain how it handles data storage.');

                await streamComplete;

                expectValidResponse(result, 20);
                expectValidResponse(streamResult, 20);
            },
            TIMEOUT
        ); */

        it(
            'handles follow-up questions correctly',
            async () => {
                const specUrl = 'https://clzddo5xy19zg3mjrmr3urtfd.agent.stage.smyth.ai/api-docs/openapi-llm.json';
                const conv = new Conversation(model, specUrl);

                await conv.prompt('What is SmythOS?');
                const followUpResult = await conv.prompt('Can you provide more details about its features?');

                expectValidResponse(followUpResult, 20);
            },
            TIMEOUT * 2
        );

        // TODO [Forhad]: Need to fix "It seems that I am unable to access the "smyth" repository due to a requirement for an access token.", with Gemini it does not work
        /* it(
            'runs a conversation with remote sentinel agent',
            async () => {
                const specUrl = 'https://closz0vak00009tsctm7e8xzs.agent.stage.smyth.ai/api-docs/openapi.json';
                const conv = new Conversation(model, specUrl);

                let streamResult = '';

                // * The order is important to ensure proper event handling:
                // 1. Set up event listeners before calling streamPrompt to capture all events. ie. const streamComplete = new Promise<string>((resolve) => {...
                // 2. Call streamPrompt to initiate the streaming process. ie. const result = await conv.streamPrompt(...);
                // 3. Wait for the stream to complete to ensure all content is received. ie. await streamComplete;
                const streamComplete = new Promise<string>((resolve) => {
                    conv.on('content', (content) => {
                        streamResult += content;
                    });
                    conv.on('end', resolve);
                });

                const result = await conv.streamPrompt('Analyze smyth runtime dependencies and tell me what S3Storage.class.ts depends on');

                await streamComplete;

                expectValidResponse(result, 20);
                expectValidResponse(streamResult, 20);
            },
            TIMEOUT * 2
        ); */

        // TODO [Forhad]: Need to check why it provides empty response with Google AI
        it(
            'runs a conversation with remote weather openAPI.json',
            async () => {
                const specUrl = 'https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/xkcd.com/1.0.0/openapi.yaml';
                const conv = new Conversation(model, specUrl);

                let streamResult = '';

                // * The order is important to ensure proper event handling:
                // 1. Set up event listeners before calling streamPrompt to capture all events. ie. const streamComplete = new Promise<string>((resolve) => {...
                // 2. Call streamPrompt to initiate the streaming process. ie. const result = await conv.streamPrompt(...);
                // 3. Wait for the stream to complete to ensure all content is received. ie. await streamComplete;
                const streamComplete = new Promise<string>((resolve) => {
                    conv.on('content', (content) => {
                        streamResult += content;
                    });
                    conv.on('end', resolve);
                });

                const result = await conv.streamPrompt('find a random comic and write a short story about it');

                await streamComplete;

                expectValidResponse(result, 20);
                expectValidResponse(streamResult, 20);
            },
            TIMEOUT
        );
    });
}

const models = ['gpt-4o-mini', 'claude-3-5-sonnet-20240620', 'gemini-1.5-flash', 'gemma2-9b-it', 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'];

for (const model of models) {
    runTestCases(model);
}
