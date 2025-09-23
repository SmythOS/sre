import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AccessCandidate, ConnectorService, SystemEvents } from 'index';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import EventEmitter from 'events';
import { delay } from '@sre/utils/index';
import { APIKeySource, SmythLLMUsage, TLLMParams, TLLMEvent } from '@sre/types/LLM.types';
import { setupSRE } from '../../utils/sre';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';

setupSRE();
const agentId = 'cm0zjhkzx0dfvhxf81u76taiz';

// import {DummyAccount} from "@sre/Security/Account.service/connectors/DummyAccount.class"

vi.mock('@sre/Security/Account.service/connectors/DummyAccount.class', async () => {
    let DummyAccount = (await import('@sre/Security/Account.service/connectors/DummyAccount.class')).DummyAccount;
    class MockedDummyAccount extends DummyAccount {
        public getTeamSetting(acRequest: AccessRequest, teamId: string, settingKey: string): Promise<string> {
            if (settingKey === 'custom-llm') {
                return Promise.resolve(
                    JSON.stringify({
                        m5zlsw6gduo: {
                            id: 'm5zlsw6gduo',
                            name: 'NEW_LLM',
                            provider: 'Bedrock',
                            features: ['text-completion'],
                            tags: ['Bedrock'],
                            settings: {
                                foundationModel: 'ai21.jamba-instruct-v1:0',
                                customModel: '',
                                region: 'us-east-1',
                                keyIDName: 'BEDROCK_TESINTG_AWS_KEY_ID',
                                secretKeyName: 'BEDROCK_TESINTG_AWS_SECRET_KEY',
                                sessionKeyName: '',
                            },
                        },
                    })
                );
            }
            return super.getTeamSetting(acRequest, teamId, settingKey);
        }
    }
    return { DummyAccount: MockedDummyAccount };
});

// SmythRuntime initialization replaced by setupSRE()

const models = [
    {
        provider: 'OpenAI',
        id: 'gpt-4o-mini',
        supportedMethods: [
            'chatRequest',
            'visionRequest',
            'multimodalRequest',
            'toolRequest',
            'streamRequest',
            'multimodalStreamRequest',
            'imageGenRequest',
        ],
    },
    // {
    //     provider: 'Anthropic',
    //     id: 'claude-3.5-sonnet',
    //     supportedMethods: ['chatRequest', 'visionRequest', 'multimodalRequest', 'toolRequest', 'streamRequest', 'multimodalStreamRequest'],
    // },
    // { provider: 'Groq', id: 'gemma2-9b-it', supportedMethods: ['chatRequest', 'toolRequest', 'streamRequest'] },
    // {
    //     provider: 'GoogleAI',
    //     id: 'gemini-1.5-flash',
    //     supportedMethods: ['chatRequest', 'visionRequest', 'multimodalRequest', 'toolRequest', 'streamRequest', 'multimodalStreamRequest'],
    // },
    // { provider: 'Bedrock', id: 'm5zlsw6gduo', supportedMethods: ['chatRequest', 'toolRequest', 'streamRequest'] },
    //* disabled for now since we have no valid access to VertexAI
    // { provider: 'VertexAI', id: 'gemini-1.5-flash', supportedMethods: ['chatRequest'] },
];

// Use static agentId. No Agent instance needed.

function listenForUsageEvent() {
    let usageEvent: SmythLLMUsage = undefined;
    SystemEvents.once('USAGE:LLM', (usage) => {
        console.log('USAGE:LLM received', usage);
        usageEvent = usage;
    });
    return {
        get(): SmythLLMUsage {
            return usageEvent;
        },
    };
}

async function consumeStream(stream) {
    // stream.on('end', resolve);
    return new Promise((resolve) => {
        stream.on('end', resolve);
    });
}

describe.each(models)('LLM Usage Reporting Tests: $provider ($id)', async ({ provider, id, supportedMethods }) => {
    let config;

    beforeEach(() => {
        config = {
            data: {
                model: id,
                maxTokens: 100,
                temperature: 0.5,
                stopSequences: '<stop>',
                topP: 0.9,
                topK: 10,
                frequencyPenalty: 0,
                presencePenalty: 0,
                responseFormat: 'json',
                cache: true,
            },
        };

        // make sure to info the user to put the needed vault keys in vault.json before running
        // "keyIDName": "BEDROCK_TESINTG_AWS_KEY_ID",
        // "secretKeyName": "BEDROCK_TESINTG_AWS_SECRET_KEY",
        console.warn('|----------------------------------------------------------|');
        console.warn('| Make sure to put the following keys in vault.json to make sure all tests pass |');
        console.warn('| BEDROCK_TESINTG_AWS_KEY_ID                                               |');
        console.warn('| BEDROCK_TESINTG_AWS_SECRET_KEY                                           |');
        console.warn('|----------------------------------------------------------|');
    });

    const llmInference: LLMInference = await LLMInference.getInstance(id, AccessCandidate.team('default'));
    const isSupported = (method: string) => supportedMethods.includes(method);
    const vaultConnector = ConnectorService.getVaultConnector();
    const apiKey = await vaultConnector
        .user(AccessCandidate.agent(agentId))
        .get(provider)
        .catch(() => '');

    //let expectedKeySource = apiKey ? APIKeySource.User : APIKeySource.Smyth;

    isSupported('chatRequest') &&
        it('should report usage for chatRequest', async () => {
            const usageEvent = listenForUsageEvent();
            const prompt = 'Hello, what is the smallest country in the world?';
            await llmInference.prompt({ query: prompt, params: { ...config.data, agentId } });
            const eventValue = usageEvent.get();
            expect(eventValue, 'Did not receive usage event').toBeDefined();
            expect(eventValue.input_tokens, 'Input tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.output_tokens, 'Output tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.sourceId, 'LLM sourceId mismatch').toContain('llm:');
            expect(eventValue.keySource, 'Key source mismatch').toBe(APIKeySource.User);
        });
    // Vision/multimodal usage is covered by prompt with files in other tests; skipping here.
    isSupported('toolRequest') &&
        it('should report usage for toolRequest', async () => {
            const usageEvent = listenForUsageEvent();
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
            await llmInference.prompt({
                query: 'Hello, how are you?',
                params: {
                    model: id,
                    toolsConfig: llmInference.connector.formatToolsConfig({
                        type: 'function',
                        toolDefinitions,
                        toolChoice: 'auto',
                    }) as any,
                    agentId,
                },
            });
            const eventValue = usageEvent.get();
            expect(eventValue, 'Did not receive usage event').toBeDefined();
            expect(eventValue.input_tokens, 'Input tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.output_tokens, 'Output tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.sourceId, 'LLM sourceId mismatch').toContain('llm:');
            expect(eventValue.keySource, 'Key source mismatch').toBe(APIKeySource.User);
        });

    isSupported('streamRequest') &&
        it('should report usage for streamRequest', async () => {
            const usageEvent = listenForUsageEvent();
            const msgs = [];
            // 30*2 messages with same q&a to test prompt caching (for eg. OpenAI starts caching when tokens >= 1024)
            for (let i = 0; i < 30; i++) {
                msgs.push({ role: 'user', content: ' Explain quantum physics in simple terms.' });
                msgs.push({
                    role: 'assistant',
                    content:
                        'Quantum physics is the study of the behavior of matter and energy at the smallest scales, where it behaves differently than it does at larger scales.',
                });
            }
            const contextWindow = [...msgs, { role: 'user', content: ' Explain quantum physics in simple terms.' }];
            const stream: any = await llmInference.promptStream({
                contextWindow,
                params: { cache: true, model: id, agentId },
            });
            await new Promise<void>((resolve) => {
                stream.on(TLLMEvent.End, resolve);
                stream.on(TLLMEvent.Error, resolve);
            });
            let eventValue = usageEvent.get();
            // if the event was not emitted even after the stream ended,
            // wait for additional 500ms in case the usage is reported after the content stream ends
            if (!eventValue) {
                await delay(500);
                eventValue = usageEvent.get();
            }
            expect(eventValue, 'Did not receive usage event').toBeDefined();
            expect(eventValue.input_tokens, 'Input tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.output_tokens, 'Output tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.sourceId, 'LLM sourceId mismatch').toContain('llm:');
            expect(eventValue.keySource, 'Key source mismatch').toBe(APIKeySource.User);
        });
    // multimodal/image generation usage tests are deprecated for this migration scope.
});
