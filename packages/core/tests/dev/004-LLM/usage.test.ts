import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { Agent } from '@sre/AgentManager/Agent.class';
import EventEmitter from 'events';
import { delay } from '@sre/utils/index';
import { APIKeySource, SmythLLMUsage, TLLMParams } from '@sre/types/LLM.types';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import path from 'path';
import { SystemEvents } from '@sre/Core/SystemEvents';

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
                    }),
                );
            }
            return super.getTeamSetting(acRequest, teamId, settingKey);
        }
    }
    return { DummyAccount: MockedDummyAccount };
});

const models = {
    'gpt-4o-mini': {
        provider: 'OpenAI',

        llm: 'OpenAI',
        modelId: 'gpt-4o-mini-2024-07-18',
        tokens: 128_000,
        completionTokens: 16_383,
        enabled: true,
        credentials: 'vault',
    },
    'claude-3.5-sonnet': {
        provider: 'Anthropic',

        llm: 'Anthropic',

        label: 'Claude 3.5 Sonnet',
        modelId: 'claude-3-5-sonnet-20240620',

        tokens: 200_000,
        completionTokens: 4096,
        enabled: true,

        credentials: 'vault',
    },
    'gemini-1.5-flash': {
        provider: 'GoogleAI',
        llm: 'GoogleAI',

        modelId: 'gemini-1.5-flash-latest',

        tokens: 1_048_576,
        completionTokens: 8192,
        enabled: true,

        credentials: 'vault',
    },

    'gemma2-9b-it': {
        provider: 'Groq',
        llm: 'Groq',

        modelId: 'gemma2-9b-it',

        tokens: 8_192,
        completionTokens: 8_192,
        enabled: true,

        credentials: 'vault',
    },
};

const TEST_DATA_PATH = process.env.DATA_DIR;
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
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: path.join(TEST_DATA_PATH, 'vault.json'),
        },
    },
    ModelsProvider: {
        Connector: 'SmythModelsProvider',
        Settings: {
            models,
        },
    },
});

const testModels = [
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
    {
        provider: 'Anthropic',
        id: 'claude-3.5-sonnet',
        supportedMethods: ['chatRequest', 'visionRequest', 'multimodalRequest', 'toolRequest', 'streamRequest', 'multimodalStreamRequest'],
    },
    { provider: 'Groq', id: 'gemma2-9b-it', supportedMethods: ['chatRequest', 'toolRequest', 'streamRequest'] },
    {
        provider: 'GoogleAI',
        id: 'gemini-1.5-flash',
        supportedMethods: ['chatRequest', 'visionRequest', 'multimodalRequest', 'toolRequest', 'streamRequest', 'multimodalStreamRequest'],
    },
    //{ provider: 'Bedrock', id: 'm5zlsw6gduo', supportedMethods: ['chatRequest', 'toolRequest', 'streamRequest'] },
    //{ provider: 'Bedrock', id: 'SRE - Bedrock for Tool Use', supportedMethods: ['chatRequest', 'toolRequest', 'streamRequest'] },
    //* disabled for now since we have no valid access to VertexAI
    // { provider: 'VertexAI', id: 'gemini-1.5-flash', supportedMethods: ['chatRequest'] },
];

// @ts-ignore (Ignore required arguments, as we are using the mocked Agent)
let agent = new Agent();

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

describe.each(testModels)('LLM Usage Reporting Tests: $provider ($id)', async ({ provider, id, supportedMethods }) => {
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
        .user(AccessCandidate.agent(agent.id))
        .get(provider.toLowerCase())
        .catch(() => '');

    let expectedKeySource = apiKey ? APIKeySource.User : APIKeySource.Smyth;

    isSupported('chatRequest') &&
        it('should report usage for chatRequest', async () => {
            const usageEvent = listenForUsageEvent();
            const prompt = 'Hello, what is the smallest country in the world?';
            await llmInference.promptRequest(prompt, config, agent);
            const eventValue = usageEvent.get();
            expect(eventValue, 'Did not receive usage event').toBeDefined();
            expect(eventValue.input_tokens, 'Input tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.output_tokens, 'Output tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.sourceId, 'LLM sourceId mismatch').toContain('llm:');
            expect(eventValue.keySource, 'Key source mismatch').toBe(expectedKeySource);
        });
    isSupported('visionRequest') &&
        it('should report usage for visionRequest', async () => {
            const usageEvent = listenForUsageEvent();
            const prompt = 'Hello, what is the smallest country in the world?';
            const fileSources = ['https://images.unsplash.com/photo-1721332155637-8b339526cf4c?q=10&w=300'];
            await llmInference.visionRequest(prompt, fileSources, config, agent);
            const eventValue = usageEvent.get();
            expect(eventValue, 'Did not receive usage event').toBeDefined();
            expect(eventValue.input_tokens, 'Input tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.output_tokens, 'Output tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.sourceId, 'LLM sourceId mismatch').toContain('llm:');
            expect(eventValue.keySource, 'Key source mismatch').toBe(expectedKeySource);
        });
    isSupported('multimodalRequest') &&
        it('should report usage for multimodalRequest', async () => {
            const usageEvent = listenForUsageEvent();
            const prompt = 'Hello, what is the smallest country in the world?';
            const fileSources = ['https://images.unsplash.com/photo-1721332155637-8b339526cf4c?q=10&w=300'];
            await llmInference.multimodalRequest(prompt, fileSources, config, agent);
            const eventValue = usageEvent.get();
            expect(eventValue, 'Did not receive usage event').toBeDefined();
            expect(eventValue.input_tokens, 'Input tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.output_tokens, 'Output tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.sourceId, 'LLM sourceId mismatch').toContain('llm:');
            expect(eventValue.keySource, 'Key source mismatch').toBe(expectedKeySource);
        });
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
            const params = {
                messages: [{ role: 'user', content: 'Hello, how are you?' }],
                toolsConfig: {
                    type: 'function',
                    toolDefinitions,
                    toolChoice: 'auto',
                },
            };

            const result = await llmInference.toolRequest(params, agent);
            const eventValue = usageEvent.get();
            expect(eventValue, 'Did not receive usage event').toBeDefined();
            expect(eventValue.input_tokens, 'Input tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.output_tokens, 'Output tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.sourceId, 'LLM sourceId mismatch').toContain('llm:');
            expect(eventValue.keySource, 'Key source mismatch').toBe(expectedKeySource);
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
            const params: Partial<TLLMParams> = {
                messages: [...msgs, { role: 'user', content: ' Explain quantum physics in simple terms.' }],
                cache: true,
                model: id,
            };
            const stream = await llmInference.streamRequest(params, agent);
            await consumeStream(stream);
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
            expect(eventValue.keySource, 'Key source mismatch').toBe(expectedKeySource);
        });
    isSupported('multimodalStreamRequest') &&
        it('should report usage for multimodalStreamRequest', async () => {
            const usageEvent = listenForUsageEvent();
            const prompt = 'Hello, what is the smallest country in the world?';
            const fileSources = ['https://images.unsplash.com/photo-1721332155637-8b339526cf4c?q=10&w=300'];
            const stream = await llmInference.multimodalStreamRequestLegacy(prompt, fileSources, config, agent);
            await consumeStream(stream);
            const eventValue = usageEvent.get();
            expect(eventValue, 'Did not receive usage event').toBeDefined();
            expect(eventValue.input_tokens, 'Input tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.output_tokens, 'Output tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.sourceId, 'LLM sourceId mismatch').toContain('llm:');
            expect(eventValue.keySource, 'Key source mismatch').toBe(expectedKeySource);
        });
    isSupported('imageGenRequest') &&
        it('should report usage for imageGenRequest', async () => {
            const usageEvent = listenForUsageEvent();
            const prompt = 'A cat';
            let args = {
                responseFormat: 'url',
                model: id,
            };
            await llmInference.imageGenRequest(prompt, args, agent);
            const eventValue = usageEvent.get();
            expect(eventValue, 'Did not receive usage event').toBeDefined();
            expect(eventValue.input_tokens, 'Input tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.output_tokens, 'Output tokens should be greater than 0').toBeGreaterThan(0);
            expect(eventValue.sourceId, 'LLM sourceId mismatch').toContain('llm:');
            expect(eventValue.keySource, 'Key source mismatch').toBe(expectedKeySource);
        });
});
