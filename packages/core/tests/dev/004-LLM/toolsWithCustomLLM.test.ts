import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SmythRuntime } from '@sre/index';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import EventEmitter from 'events';
import { delay } from '@sre/utils/index';

/*
 * This file contains tests for the `toolRequest` and `streamRequest` functions with Custom LLM.
 * These tests ensure that the responses include the correct tool information
 * and handle various scenarios, such as using multiple tools, handling errors,
 * and streaming responses.
 */

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
        Connector: 'Smyth',
        Settings: {
            agentStageDomain: process.env.AGENT_DOMAIN || '',
            agentProdDomain: process.env.PROD_AGENT_DOMAIN || '',
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
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
    Vault: {
        Connector: 'SmythVault',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            vaultAPIBaseUrl: process.env.SMYTH_VAULT_API_BASE_URL,
        },
    },
});

let agentId = 'clv0s83pw078qa80uv5zjy3cc';
const teamId = 'cloilcrl9001v9tkguilsu8dx';

const TIMEOUT = 30000;

async function runToolTestCases(model: string) {
    const llmInference: LLMInference = await LLMInference.getInstance(model, teamId);

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
                messages: [{ role: 'user', content: "What's current weather in New York?" }],
                toolsConfig,
            };

            const result = await llmInference.toolRequest(params, agentId);
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

            const result = await llmInference.toolRequest(params, agentId);
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

            const result = await llmInference.toolRequest(params, agentId);
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

            expect(llmInference.toolRequest(params, agentId)).rejects.toThrow();
        },
        TIMEOUT
    );
}

async function runStreamRequestTestCases(model: string) {
    const llmInference: LLMInference = await LLMInference.getInstance(model, teamId);

    it(
        'should stream a simple request',
        async () => {
            const params = {
                messages: [{ role: 'user', content: 'Tell me a short story.' }],
            };

            const stream = await llmInference.streamRequest(params, agentId);
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

            const stream = await llmInference.streamRequest(params, agentId);
            expect(stream).toBeInstanceOf(EventEmitter);

            let toolsData;

            const streamComplete = new Promise<void>((resolve) => {
                stream.on('toolsData', (data) => {
                    toolsData = data;
                    resolve();
                });
            });

            await streamComplete;

            expect(toolsData).toBeTruthy();
            expect(toolsData[0].name).toBe('get_weather');
        },
        TIMEOUT * 2
    );

    it(
        'should handle errors in stream gracefully',
        async () => {
            const params = {
                messages: [], // Empty messages array should cause an error
            };

            const stream = await llmInference.streamRequest(params, agentId);
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

async function runMultipleToolRequestTestCases(model: string, provider?: string) {
    const llmInference: LLMInference = await LLMInference.getInstance(model, teamId);
    let toolDefinitions;
    let toolsConfig;
    let params;

    beforeEach(() => {
        toolDefinitions = [
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

        toolsConfig = llmInference.connector.formatToolsConfig({
            type: 'function',
            toolDefinitions,
            toolChoice: 'auto',
        });

        params = {
            messages: [
                {
                    role: 'user',
                    content:
                        "I need two pieces of information in a single response: 1) What's the current weather in New York City? 2) What's the exact population of New York City? Please ensure both tools are used simultaneously to provide a comprehensive answer.",
                },
            ],
            toolsConfig,
        };
    });

    it(
        'should return multiple tools info with toolRequest()',
        async () => {
            const result = await llmInference.toolRequest(params, agentId);
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
            // wait 10 seconds to prevent error like "Request was rejected due to request rate limiting..." for TogetherAI
            if (provider === 'TogetherAI') {
                await delay(10000);
            }

            const stream = await llmInference.streamRequest(params, agentId);
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
        TIMEOUT * 2
    );
}

const models = [{ provider: 'Bedrock', id: 'SRE - Bedrock for Tool Use' }];

for (const model of models) {
    describe(`Tool Request Tests: ${model.provider} (${model.id})`, async () => {
        await runToolTestCases(model.id);
    });

    describe(`Stream Request Tests: ${model.provider} (${model.id})`, async () => {
        await runStreamRequestTestCases(model.id);
    });
}

const modelsWithMultipleToolsResponse = [{ provider: 'Bedrock', id: 'SRE - Bedrock for Tool Use' }];
for (const model of modelsWithMultipleToolsResponse) {
    describe(`Multiple Tools Request Tests: ${model.provider} (${model.id})`, async () => {
        await runMultipleToolRequestTestCases(model.id, model.provider);
    });
}
