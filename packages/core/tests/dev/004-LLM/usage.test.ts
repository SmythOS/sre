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
        usageEvent = usage;
    });
    return {
        get() {
            return usageEvent;
        }
    }
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
        await llmInference.visionRequest(prompt, config, agent);
        expect(usageEvent.get(), "Did not receive usage event").toBeDefined();
    });
    it('should report usage for multimodalRequest', async () => {
        const usageEvent = listenForUsageEvent();
        const prompt = 'Hello, what is the smallest country in the world?';
        await llmInference.multimodalRequest(prompt, config, agent);
        expect(usageEvent.get(), "Did not receive usage event").toBeDefined();
    });
    it('should report usage for toolRequest', async () => {
        const usageEvent = listenForUsageEvent();
        const prompt = 'Hello, what is the smallest country in the world?';
        await llmInference.toolRequest(prompt, config, agent);
        expect(usageEvent.get(), "Did not receive usage event").toBeDefined();
    });
    it('should report usage for streamToolRequest', async () => {
        const usageEvent = listenForUsageEvent();
        const prompt = 'Hello, what is the smallest country in the world?';
        await llmInference.streamToolRequest(prompt, config, agent);
        expect(usageEvent.get(), "Did not receive usage event").toBeDefined();
    });
    it('should report usage for streamRequest', async () => {
        const usageEvent = listenForUsageEvent();
        const prompt = 'Hello, what is the smallest country in the world?';
        await llmInference.streamRequest(prompt, config, agent);
        expect(usageEvent.get(), "Did not receive usage event").toBeDefined();
    });
    it('should report usage for multimodalStreamRequest', async () => {
        const usageEvent = listenForUsageEvent();
        const prompt = 'Hello, what is the smallest country in the world?';
        await llmInference.multimodalStreamRequest(prompt, config, agent);
        expect(usageEvent.get(), "Did not receive usage event").toBeDefined();
    });
    it('should report usage for imageGenRequest', async () => {
        const usageEvent = listenForUsageEvent();
        const prompt = 'Hello, what is the smallest country in the world?';
        await llmInference.imageGenRequest(prompt, config, agent);
        expect(usageEvent.get(), "Did not receive usage event").toBeDefined();
    });
});
