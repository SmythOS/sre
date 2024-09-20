import { describe, expect, it, vi } from 'vitest';
import config from '@sre/config';
import { SmythRuntime } from '@sre/index';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import Agent from '@sre/AgentManager/Agent.class';
import EventEmitter from 'events';

/*
 * This file contains tests for the `toolRequest` and `streamRequest` functions.
 * These tests ensure that the responses include the correct tool information
 * and handle various scenarios, such as using multiple tools, handling errors,
 * and streaming responses.
 */

// Mock Agent class
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => {
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
    Account: {
        Connector: 'SmythAccount',
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

async function runToolTestCases(model: string) {
    const llmInference: LLMInference = await LLMInference.load(model);

    it(
        'should execute a simple tool request',
        async () => {
            const toolDefinitions = [
                {
                    name: 'get_weather',
                    description: 'Get the current weather',
                    properties: {
                        location: { type: 'string' },
                    },
                    requiredFields: ['location'],
                },
            ];

            const toolsConfig = llmInference.connector.formatToolsConfig({
                type: 'function',
                toolDefinitions,
                toolChoice: 'auto',
            });

            const params = {
                messages: [{ role: 'user', content: "What's current weather in Bangladesh?" }],
                toolsConfig,
            };

            const result = await llmInference.toolRequest(params, agent);
            expect(result).toBeTruthy();
            expect(result.data).toBeTruthy();
            expect(result.data.useTool).toBe(true);
            expect(result.data.toolsData).toBeInstanceOf(Array);
            expect(result.data.toolsData.length).toBeGreaterThan(0);
            expect(result.data.toolsData[0].name).toBe('get_weather');
        },
        TIMEOUT
    );

    it(
        'should handle tool requests with no tools used',
        async () => {
            const toolDefinitions = [
                {
                    name: 'get_weather',
                    description: 'Get the current weather',
                    properties: {
                        location: { type: 'string' },
                    },
                    requiredFields: ['location'],
                },
            ];

            const params = {
                messages: [{ role: 'user', content: 'Hello, how are you?' }],
                toolsConfig: {
                    type: 'function',
                    toolDefinitions,
                    toolChoice: 'auto',
                },
            };

            const result = await llmInference.toolRequest(params, agent);
            expect(result).toBeTruthy();
            expect(result.data).toBeTruthy();
            expect(result.data.useTool).toBe(false);
            expect(result.data.content).toBeTruthy();
        },
        TIMEOUT
    );

    it(
        'should handle requests with empty toolDefinitions',
        async () => {
            const params = {
                messages: [{ role: 'user', content: "What's the weather like today?" }],
                toolsConfig: {
                    type: 'function',
                    toolDefinitions: [], // Empty tools array
                    toolChoice: 'auto',
                },
            };

            const result = await llmInference.toolRequest(params, agent);
            expect(result).toBeTruthy();
            expect(result.data).toBeTruthy();
            expect(result.data.useTool).toBe(false);
            expect(result.data.content).toBeTruthy();
        },
        TIMEOUT
    );

    it(
        'should handle errors in toolRequest gracefully',
        async () => {
            const params = {
                messages: [], // Empty messages array should cause an error
            };

            expect(llmInference.toolRequest(params, agent)).rejects.toThrow();
        },
        TIMEOUT
    );
}

async function runStreamRequestTestCases(model: string) {
    const llmInference: LLMInference = await LLMInference.load(model);

    it(
        'should stream a simple request',
        async () => {
            const params = {
                messages: [{ role: 'user', content: 'Tell me a short story.' }],
            };

            const stream = await llmInference.streamRequest(params, agent);
            expect(stream).toBeInstanceOf(EventEmitter);

            let content = '';

            const streamComplete = new Promise<void>((resolve) => {
                stream.on('content', (chunk) => {
                    content += chunk;
                });

                stream.on('end', resolve);
            });

            await streamComplete;

            expect(content).toBeTruthy();
        },
        TIMEOUT
    );

    it(
        'should handle streaming with tools',
        async () => {
            const toolDefinitions = [
                {
                    name: 'get_weather',
                    description: 'Get the current weather',
                    properties: {
                        location: { type: 'string' },
                    },
                    requiredFields: ['location'],
                },
            ];

            const toolsConfig = llmInference.connector.formatToolsConfig({
                type: 'function',
                toolDefinitions,
                toolChoice: 'auto',
            });

            const params = {
                messages: [{ role: 'user', content: "What's the current weather in Bangladesh?" }],
                toolsConfig,
            };

            const stream = await llmInference.streamRequest(params, agent);
            expect(stream).toBeInstanceOf(EventEmitter);

            let toolsData;

            const getToolsData = () => {
                return new Promise<void>((resolve) => {
                    stream.on('toolsData', resolve);
                });
            };

            const streamComplete = new Promise<void>((resolve) => {
                stream.on('toolsData', (data) => {
                    toolsData = data;
                });
                stream.on('end', resolve);
            });

            await streamComplete;

            expect(toolsData).toBeTruthy();
            expect(toolsData[0].name).toBe('get_weather');
        },
        TIMEOUT
    );

    it(
        'should handle errors in stream gracefully',
        async () => {
            const params = {
                messages: [], // Empty messages array should cause an error
            };

            const stream = await llmInference.streamRequest(params, agent);
            expect(stream).toBeInstanceOf(EventEmitter);

            let error;

            const streamComplete = new Promise<void>((resolve) => {
                stream.on('error', (e) => {
                    error = e;
                });
                stream.on('end', resolve);
            });

            await streamComplete;

            expect(error).toBeInstanceOf(Error);
        },
        TIMEOUT
    );
}

async function runMultipleToolRequestTestCases(model: string) {
    const llmInference: LLMInference = await LLMInference.load(model);

    const toolDefinitions = [
        {
            name: 'get_weather',
            description: 'Get the current weather',
            properties: {
                location: { type: 'string' },
            },
            requiredFields: ['location'],
        },
        {
            name: 'get_population',
            description: 'Get the population of a city',
            properties: {
                city: { type: 'string' },
            },
            requiredFields: ['city'],
        },
    ];

    const toolsConfig = llmInference.connector.formatToolsConfig({
        type: 'function',
        toolDefinitions,
        toolChoice: 'auto',
    });

    const params = {
        messages: [{ role: 'user', content: "What's the weather like in New York and what's the population?" }],
        toolsConfig,
    };

    it(
        'should return multiple tools info with toolRequest()',
        async () => {
            const result = await llmInference.toolRequest(params, agent);
            expect(result).toBeTruthy();
            expect(result.data).toBeTruthy();
            expect(result.data.useTool).toBe(true);
            expect(result.data.toolsData).toBeInstanceOf(Array);
            expect(result.data.toolsData.length).toBe(2);
            expect(result.data.toolsData[0].name).toBe('get_weather');
            expect(result.data.toolsData[1].name).toBe('get_population');
        },
        TIMEOUT
    );

    it(
        'should return multiple tools info with streamRequest()',
        async () => {
            const stream = await llmInference.streamRequest(params, agent);
            expect(stream).toBeInstanceOf(EventEmitter);

            let toolsData: any[] = [];

            const streamComplete = new Promise<void>((resolve) => {
                stream.on('toolsData', (data) => {
                    toolsData = toolsData.concat(data);
                });

                stream.on('end', resolve);
            });

            await streamComplete;

            expect(toolsData).toBeInstanceOf(Array);
            expect(toolsData.length).toBe(2);
            expect(toolsData[0].name).toBe('get_weather');
            expect(toolsData[1].name).toBe('get_population');
        },
        TIMEOUT
    );
}

const models = [
    'gpt-4o-mini', // OpenAI
    'claude-3-5-sonnet-20240620', // Anthropic AI
    'gemini-1.5-flash', // Google AI
    'gemma2-9b-it', // Groq
    'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', // TogetherAI
];

for (const model of models) {
    describe(`Tool Request Tests for Model: ${model}`, async () => {
        await runToolTestCases(model);
    });

    describe(`Stream Request Tests for Model: ${model}`, async () => {
        await runStreamRequestTestCases(model);
    });
}

/*
 * Google AI and Groq do not return multiple tool data in a single response.
 * Therefore, the expectation "(result.data.toolsData.length).toBe(2)" does not apply to them.
 * They may provide additional tool data in subsequent requests.
 * Tests for the sequence of tool responses are available in conversation.test.ts.
 */
const modelsWithMultipleToolsResponse = [
    'gpt-4o-mini', // OpenAI
    'claude-3-5-sonnet-20240620', // Anthropic AI
    'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', // TogetherAI
];
for (const model of modelsWithMultipleToolsResponse) {
    describe(`Multiple Tools Request Tests for Model: ${model}`, async () => {
        await runMultipleToolRequestTestCases(model);
    });
}
