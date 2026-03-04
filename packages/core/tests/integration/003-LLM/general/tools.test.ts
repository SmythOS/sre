import { describe, expect, it, beforeEach } from 'vitest';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { setupSRE } from '../../../utils/sre';
import EventEmitter from 'events';
import { TLLMEvent } from '@sre/types/LLM.types';
import { delay } from '@sre/utils/index';
import { checkIntegrationTestConsent } from '../../../utils/test-data-manager';

checkIntegrationTestConsent();
/*
 * This file contains tests for the `toolRequest` and `streamRequest` functions.
 * These tests ensure that the responses include the correct tool information
 * and handle various scenarios, such as using multiple tools, handling errors,
 * and streaming responses.
 */

setupSRE();

const agentId = 'cm0zjhkzx0dfvhxf81u76taiz';

const TIMEOUT = 30000;

async function runToolTestCases(model: string) {
    const llmInference: LLMInference = await LLMInference.getInstance(model, AccessCandidate.team('default'));

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

            const toolsConfig: any = llmInference.connector.formatToolsConfig({
                type: 'function',
                toolDefinitions,
                toolChoice: 'auto',
            }) as any;

            const stream: any = await llmInference.promptStream({
                query: "What's current weather in New York?",
                params: { model, toolsConfig, agentId },
            });

            let toolsData: any[] = [];
            const streamComplete = new Promise<void>((resolve) => {
                stream.on(TLLMEvent.ToolInfo, (data) => {
                    toolsData = toolsData.concat(data);
                });
                stream.on(TLLMEvent.End, resolve);
            });

            await streamComplete;

            expect(toolsData).toBeInstanceOf(Array);
            expect(toolsData.length).toBeGreaterThan(0);
            expect(toolsData[0].name).toBe('get_weather');
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

            const stream: any = await llmInference.promptStream({
                query: 'Hello, how are you?',
                params: {
                    model,
                    toolsConfig: llmInference.connector.formatToolsConfig({
                        type: 'function',
                        toolDefinitions,
                        toolChoice: 'auto',
                    }) as any,
                    agentId,
                },
            });

            let usedTool = false;
            let content = '';
            const streamComplete = new Promise<void>((resolve) => {
                stream.on(TLLMEvent.ToolInfo, () => {
                    usedTool = true;
                });
                stream.on(TLLMEvent.Content, (chunk) => {
                    content += chunk;
                });
                stream.on(TLLMEvent.End, resolve);
            });

            await streamComplete;

            expect(usedTool).toBe(false);
            expect(content).toBeTruthy();
        },
        TIMEOUT
    );

    it(
        'should handle requests with empty toolDefinitions',
        async () => {
            const stream: any = await llmInference.promptStream({
                query: "What's the weather like today?",
                params: {
                    model,
                    toolsConfig: llmInference.connector.formatToolsConfig({
                        type: 'function',
                        toolDefinitions: [], // Empty tools array
                        toolChoice: 'auto',
                    }) as any,
                    agentId,
                },
            });

            let usedTool = false;
            let content = '';
            const streamComplete = new Promise<void>((resolve) => {
                stream.on(TLLMEvent.ToolInfo, () => {
                    usedTool = true;
                });
                stream.on(TLLMEvent.Content, (chunk) => {
                    content += chunk;
                });
                stream.on(TLLMEvent.End, resolve);
            });

            await streamComplete;

            expect(usedTool).toBe(false);
            expect(content).toBeTruthy();
        },
        TIMEOUT
    );

    it(
        'should handle errors in toolRequest gracefully',
        async () => {
            const stream: any = await llmInference.promptStream({ params: { model, agentId } });

            let error;
            const streamComplete = new Promise<void>((resolve) => {
                stream.on(TLLMEvent.Error, (e) => (error = e));
                stream.on(TLLMEvent.End, resolve);
            });

            await streamComplete;

            expect(error).toBeInstanceOf(Error);
        },
        TIMEOUT
    );
}

async function runStreamRequestTestCases(model: string) {
    const llmInference: LLMInference = await LLMInference.getInstance(model, AccessCandidate.team('default'));

    it(
        'should stream a simple request',
        async () => {
            const params = {
                messages: [{ role: 'user', content: 'Tell me a short story.' }],
                model,
            };

            const stream = await llmInference.promptStream({
                contextWindow: params.messages,
                params: { model: params.model, agentId },
            });
            expect(stream).toBeInstanceOf(EventEmitter);

            let content = '';

            const streamComplete = new Promise<void>((resolve) => {
                stream.on(TLLMEvent.Content, (chunk) => {
                    content += chunk;
                });

                stream.on(TLLMEvent.End, resolve);
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
                model,
            };

            const stream = await llmInference.promptStream({
                contextWindow: params.messages,
                params: { model: params.model, toolsConfig: params.toolsConfig as any, agentId },
            });
            expect(stream).toBeInstanceOf(EventEmitter);

            let toolsData;

            const streamComplete = new Promise<void>((resolve) => {
                stream.on(TLLMEvent.ToolInfo, (data) => {
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
                model,
            };

            const stream = await llmInference.promptStream({
                contextWindow: params.messages,
                params: { model: params.model, agentId },
            });
            expect(stream).toBeInstanceOf(EventEmitter);

            let error;

            const streamComplete = new Promise<void>((resolve) => {
                stream.on(TLLMEvent.Error, (e) => {
                    error = e;
                });
                stream.on(TLLMEvent.End, resolve);
            });

            await streamComplete;

            expect(error).toBeInstanceOf(Error);
        },
        TIMEOUT
    );
}

async function runMultipleToolRequestTestCases(model: string, provider?: string) {
    const llmInference: LLMInference = await LLMInference.getInstance(model, AccessCandidate.team('default'));
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
        }) as any;

        params = {
            messages: [
                {
                    role: 'user',
                    content:
                        "I need two pieces of information in a single response: 1) What's the current weather in New York City? 2) What's the exact population of New York City? Please ensure both tools are used simultaneously to provide a comprehensive answer.",
                },
            ],
            toolsConfig,
            model,
        };
    });

    it(
        'should return multiple tools info with promptStream()',
        async () => {
            const stream: any = await llmInference.promptStream({
                params: { ...params, model, agentId },
                contextWindow: params.messages,
            });

            let toolsData: any[] = [];
            let error;
            const streamComplete = new Promise<void>((resolve) => {
                stream.on(TLLMEvent.Error, (e) => {
                    error = e;
                    resolve();
                });
                stream.on(TLLMEvent.ToolInfo, (data) => {
                    toolsData = toolsData.concat(data);
                });
                stream.on(TLLMEvent.End, resolve);
            });

            await streamComplete;

            expect(error).toBeFalsy();
            expect(toolsData).toBeInstanceOf(Array);
            expect(toolsData.length).toBe(2);
            expect(toolsData[0].name).toBe('get_weather');
            expect(toolsData[1].name).toBe('get_population');
        },
        TIMEOUT
    );

    it(
        'should return multiple tools info with promptStream()',
        async () => {
            // wait 10 seconds to prevent error like "Request was rejected due to request rate limiting..." for TogetherAI
            if (provider === 'TogetherAI') {
                await delay(10000);
            }

            const stream = await llmInference.promptStream({
                contextWindow: params.messages,
                params: { model: params.model, toolsConfig: params.toolsConfig as any, agentId },
            });
            expect(stream).toBeInstanceOf(EventEmitter);

            let toolsData: any[] = [];
            let error;

            const streamComplete = new Promise<void>((resolve) => {
                stream.on(TLLMEvent.Error, (e) => {
                    error = e;
                    resolve();
                });
                stream.on(TLLMEvent.ToolInfo, (data) => {
                    toolsData = toolsData.concat(data);
                });
                stream.on(TLLMEvent.End, resolve);
            });

            await streamComplete;

            expect(error).toBeFalsy();
            expect(toolsData).toBeInstanceOf(Array);
            expect(toolsData.length).toBe(2);
            expect(toolsData[0].name).toBe('get_weather');
            expect(toolsData[1].name).toBe('get_population');
        },
        TIMEOUT * 2
    );
}

import testModels from './testModels';

for (const model of testModels) {
    describe(`Tool Request Tests: ${model.provider} (${model.id})`, async () => {
        await runToolTestCases(model.id);
    });

    describe(`Stream Request Tests: ${model.provider} (${model.id})`, async () => {
        await runStreamRequestTestCases(model.id);
    });
}

/*
 * Google AI and Groq do not return multiple tool data in a single response.
 * Therefore, the expectation "(result.data.toolsData.length).toBe(2)" does not apply to them.
 * They may provide additional tool data in subsequent requests.
 * Tests for the sequence of tool responses are available in conversation.test.ts.
 */

const modelsWithMultipleToolsResponse = testModels.filter((model) => model.features.includes('multiple-tools'));

for (const model of modelsWithMultipleToolsResponse) {
    describe(`Multiple Tools Request Tests: ${model.provider} (${model.id})`, async () => {
        await runMultipleToolRequestTestCases(model.id, model.provider);
    });
}
