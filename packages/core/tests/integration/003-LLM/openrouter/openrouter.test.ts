/**
 * OpenRouter Integration Tests
 *
 * These tests verify that the OpenRouterConnector works end-to-end with the
 * real OpenRouter API. They cover:
 *   - Basic prompt (non-streaming)
 *   - Streaming prompt via EventEmitter
 *   - Tool calling (function calling)
 *   - JSON response format
 *
 * Requirements:
 *   - A valid OPENROUTER_API_KEY must be available in the vault / environment.
 *   - Integration test consent must be given (see test-data-manager).
 *
 * Test model: openrouter/mistral-large
 * Mistral Large supports text generation and tool calling, making it a good
 * representative model for validating the full connector surface area.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TLLMEvent, TLLMMessageRole } from '@sre/types/LLM.types';
import { setupSRE } from '../../../utils/sre';
import { checkIntegrationTestConsent } from '../../../utils/test-data-manager';

checkIntegrationTestConsent();
setupSRE();

const TEST_MODEL = 'openrouter/mistral-large';
const agentId = 'cm0zjhkzx0dfvhxf81u76taiz';
const TIMEOUT = 30_000;

// A unique string injected into prompts so we can assert the model actually
// followed the instruction and the response is not a cached/stubbed value.
const LLM_OUTPUT_VALIDATOR = 'Yohohohooooo!';
const WORD_INCLUSION_PROMPT = `\nAll your responses must include "${LLM_OUTPUT_VALIDATOR}". If the response is JSON, include an additional key "${LLM_OUTPUT_VALIDATOR}" with value "${LLM_OUTPUT_VALIDATOR}".\n\n`;

describe(`OpenRouter Connector — ${TEST_MODEL}`, async () => {
    let llmInference: LLMInference;
    let baseParams: any;

    beforeEach(async () => {
        llmInference = await LLMInference.getInstance(TEST_MODEL, AccessCandidate.team('default'));

        baseParams = {
            model: TEST_MODEL,
            maxTokens: 256,
            temperature: 0.5,
            agentId,
        };
    });

    // ── Basic prompt ──────────────────────────────────────────────────────────
    it(
        'returns a valid response for a simple prompt',
        async () => {
            const result = await llmInference.prompt({
                query: WORD_INCLUSION_PROMPT + 'What is the capital of France?',
                params: baseParams,
            });

            expect(result).toBeTruthy();
            expect(JSON.stringify(result)).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        'handles a system message correctly',
        async () => {
            const messages = [
                { role: TLLMMessageRole.System, content: 'You are a helpful assistant. ' + WORD_INCLUSION_PROMPT },
                { role: TLLMMessageRole.User, content: 'What can you do?' },
            ];

            const result = await llmInference.prompt({
                contextWindow: messages,
                params: baseParams,
            });

            expect(result).toBeTruthy();
            expect(JSON.stringify(result)).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    // ── JSON response format ──────────────────────────────────────────────────
    it(
        'returns a parseable JSON object when responseFormat is json',
        async () => {
            const result = await llmInference.prompt({
                query: WORD_INCLUSION_PROMPT + 'Name three programming languages.',
                params: { ...baseParams, responseFormat: 'json' },
            });

            expect(result).toBeTruthy();
            // LLMInference.prompt already parses JSON responses — result should be an object
            expect(typeof result).toBe('object');
            expect(JSON.stringify(result)).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    // ── Streaming ─────────────────────────────────────────────────────────────
    it(
        'streams content chunks via EventEmitter',
        async () => {
            let streamedContent = '';
            let endFired = false;

            // promptStream returns the EventEmitter — attach listeners on it.
            // The setImmediate inside OpenRouterConnector.streamRequest defers all
            // event emission to the next tick, so attaching listeners immediately
            // after the await is safe and race-condition-free.
            const emitter = await llmInference.promptStream({
                query: WORD_INCLUSION_PROMPT + 'Tell me a one-sentence fun fact about space.',
                params: baseParams,
            });

            const streamComplete = new Promise<void>((resolve) => {
                emitter.on(TLLMEvent.Content, (chunk: string) => {
                    streamedContent += chunk;
                });
                emitter.on(TLLMEvent.End, () => {
                    endFired = true;
                    resolve();
                });
            });

            await streamComplete;

            expect(streamedContent).toBeTruthy();
            expect(streamedContent).toContain(LLM_OUTPUT_VALIDATOR);
            expect(endFired).toBe(true);
        },
        TIMEOUT
    );

    // ── Tool calling ──────────────────────────────────────────────────────────
    it(
        'invokes a tool and returns tool call data',
        async () => {
            const toolDefinitions = [
                {
                    name: 'get_weather',
                    description: 'Get the current weather for a given city',
                    properties: {
                        location: { type: 'string', description: 'City name' },
                    },
                    requiredFields: ['location'],
                },
            ];

            const toolsConfig: any = llmInference.connector.formatToolsConfig({
                type: 'function',
                toolDefinitions,
                toolChoice: 'auto',
            });

            let toolsData: any[] = [];

            const emitter = await llmInference.promptStream({
                query: "What's the weather like in Paris right now?",
                params: { ...baseParams, toolsConfig },
            });

            const streamComplete = new Promise<void>((resolve) => {
                emitter.on(TLLMEvent.ToolInfo, (data: any[]) => {
                    toolsData = toolsData.concat(data);
                });
                emitter.on(TLLMEvent.End, () => resolve());
            });

            await streamComplete;

            expect(toolsData.length).toBeGreaterThan(0);
            expect(toolsData[0].name).toBe('get_weather');
            expect(JSON.parse(toolsData[0].arguments)).toHaveProperty('location');
        },
        TIMEOUT
    );
});
