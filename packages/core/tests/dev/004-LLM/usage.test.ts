import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SmythRuntime, SystemEvents } from '@sre/index';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import Agent from '@sre/AgentManager/Agent.class';
import EventEmitter from 'events';
import { delay } from '@sre/utils/index';


// Mock Agent class to keep the test isolated from the actual Agent implementation
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => {
        // Inherit Agent.prototype for proper instanceof Agent checks
        return Object.create(Agent.prototype, {
            id: { value: 'cm0zjhkzx0dfvhxf81u76taiz' },
            teamId: { value: 'cloilcrl9001v9tkguilsu8dx' },
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
});

const models = [
    { provider: 'OpenAI', id: 'gpt-4o-mini-2024-07-18' },
    { provider: 'Anthropic', id: 'claude-3-haiku-20240307' },
    { provider: 'GoogleAI', id: 'gemini-1.5-flash' },
    { provider: 'Groq', id: 'gemma2-9b-it' },
    { provider: 'TogetherAI', id: 'meta-llama/Meta-Llama-3-8B-Instruct-Lite' },
    { provider: 'xAI', id: 'grok-beta' },
];

// @ts-ignore (Ignore required arguments, as we are using the mocked Agent)
let agent = new Agent();

function listenForUsageEvent(){
    let usageEvent: any = undefined;
    SystemEvents.once('USAGE:LLM', (usage) => {
        console.log("USAGE:LLM received", usage);
        usageEvent = usage;
    });
    return {
        get() {
            return usageEvent;
        }
    }
}

async function consumeStream(stream) {
    // stream.on('end', resolve);
    return new Promise((resolve) => {
        stream.on('end', resolve);
    });
}

describe.each(models)('LLM Usage Reporting Tests: $provider ($id)', async ({ provider, id }) => {
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
            },
        };
    });

    const llmInference: LLMInference = await LLMInference.getInstance(id);

    it('should report usage for chatRequest', async () => {
        
        const usageEvent = listenForUsageEvent();
        const prompt = 'Hello, what is the smallest country in the world?';
        await llmInference.promptRequest(prompt, config, agent);
        expect(usageEvent.get(), "Did not receive usage event").toBeDefined();

    });
    it('should report usage for visionRequest', async () => {
        const usageEvent = listenForUsageEvent();
        const prompt = 'Hello, what is the smallest country in the world?';
        const fileSources = ['https://images.unsplash.com/photo-1721332155637-8b339526cf4c?q=10&w=300'];
        await llmInference.visionRequest(prompt, fileSources, config, agent);
        expect(usageEvent.get(), "Did not receive usage event").toBeDefined();
    });
    it('should report usage for multimodalRequest', async () => {
        const usageEvent = listenForUsageEvent();
        const prompt = 'Hello, what is the smallest country in the world?';
        const fileSources = ['https://images.unsplash.com/photo-1721332155637-8b339526cf4c?q=10&w=300'];
        await llmInference.multimodalRequest(prompt, fileSources, config, agent);
        expect(usageEvent.get(), "Did not receive usage event").toBeDefined();
    });
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
        expect(usageEvent.get(), "Did not receive usage event").toBeDefined();
    });
    it('should report usage for streamToolRequest', async () => {
        if (["Anthropic"].includes(provider)) return Promise.resolve();
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
            messages: [{ role: 'user', content: 'Hello, how are you? Tell me a short story' }],
            toolsConfig: {
                type: 'function',
                toolDefinitions,
                toolChoice: 'auto',
            },
        };
        
        const stream = await llmInference.streamToolRequest(params, agent);
        await consumeStream(stream);
        expect(usageEvent.get(), "Did not receive usage event").toBeDefined();
    });
    it('should report usage for streamRequest', async () => {
        const usageEvent = listenForUsageEvent();
        const params = {
            messages: [{ role: 'user', content: 'Tell me a very short story. 15 words or less.' }],
        };
        const stream = await llmInference.streamRequest(params, agent);
        await consumeStream(stream);
        expect(usageEvent.get(), "Did not receive usage event").toBeDefined();
    });
    it('should report usage for multimodalStreamRequest', async () => {
        const usageEvent = listenForUsageEvent();
        const prompt = 'Hello, what is the smallest country in the world?';
        const fileSources = ['https://images.unsplash.com/photo-1721332155637-8b339526cf4c?q=10&w=300'];
        const stream = await llmInference.multimodalStreamRequest(prompt, fileSources, config, agent);
        await consumeStream(stream);
        expect(usageEvent.get(), "Did not receive usage event").toBeDefined();
    });
    it('should report usage for imageGenRequest', async () => {
        if (["Anthropic"].includes(provider)) return Promise.resolve();
        const usageEvent = listenForUsageEvent();
        const prompt = 'A cat';
        let args = {
            responseFormat: 'url',
            model: id,
        };
        await llmInference.imageGenRequest(prompt, args, agent);
        expect(usageEvent.get(), "Did not receive usage event").toBeDefined();
    });
});
