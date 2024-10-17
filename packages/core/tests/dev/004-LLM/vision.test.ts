import { describe, expect, it, vi } from 'vitest';
import config from '@sre/config';
import { SmythRuntime } from '@sre/index';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import Agent from '@sre/AgentManager/Agent.class';

// Mock Agent class to keep the test isolated from the actual Agent implementation
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => {
        // Inherit Agent.prototype for proper instanceof Agent checks
        return Object.create(Agent.prototype, {
            id: { value: 'cm0zjhkzx0dfvhxf81u76taiz' },
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

// @ts-ignore (Ignore required arguments, as we are using the mocked Agent)
let agent = new Agent();

const TIMEOUT = 30000;
const LLM_OUTPUT_VALIDATOR = 'Yohohohooooo!';
const WORD_INCLUSION_PROMPT = `\nThe response must includes "${LLM_OUTPUT_VALIDATOR}".`;

async function runVisionTestCases(model: string) {
    const config = {
        data: {
            model,
            maxTokens: 200,
        },
    };
    const llmInference: LLMInference = await LLMInference.getInstance(model);

    const imageUrl1 = 'https://fastly.picsum.photos/id/478/536/354.jpg?hmac=adxYyHX8WcCfHkk07quT2s92fbC7vY2QttaeBztwxgI';
    const imageUrl2 = 'https://fastly.picsum.photos/id/1038/536/354.jpg?hmac=Hu6nao4zkSvq_pHo5pIssp8oYizJus3yfL956AXww70';
    const imageUrl3 = 'https://fastly.picsum.photos/id/533/536/354.jpg?hmac=jRXOQOhY0DMDE0jgxz4LsOlmfwO4keMU6sh258s8OIQ';

    it(
        `runs a simple vision request with a single image for Model: ${model}`,
        async () => {
            const prompt = 'What is in this image?' + WORD_INCLUSION_PROMPT;
            const fileSources = [imageUrl1];
            const result: any = await llmInference.visionRequest(prompt, fileSources, config, agent);
            expect(result).toBeTruthy();
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        `handles multiple images in a single request for Model: ${model}`,
        async () => {
            const prompt = 'Compare these two images' + WORD_INCLUSION_PROMPT;
            const fileSources = [imageUrl1, imageUrl2];
            const result: any = await llmInference.visionRequest(prompt, fileSources, config, agent);
            expect(result).toBeTruthy();
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        `handles different image formats correctly for Model: ${model}`,
        async () => {
            const prompt = 'Describe these images' + WORD_INCLUSION_PROMPT;
            const fileSources = [imageUrl1, imageUrl2, imageUrl3];
            const result: any = await llmInference.visionRequest(prompt, fileSources, config, agent);
            expect(result).toBeTruthy();
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        `handles invalid image files gracefully for Model: ${model}`,
        async () => {
            const fileSources = ['invalid-url'];
            await expect(llmInference.visionRequest('What is in this image?', fileSources, config, agent)).rejects.toThrow();
        },
        TIMEOUT
    );

    it(
        `handles empty file sources array for Model: ${model}`,
        async () => {
            const fileSources = [];
            await expect(llmInference.visionRequest('What is in this image?', fileSources, config, agent)).rejects.toThrow();
        },
        TIMEOUT
    );

    it(
        `handles complex prompts with images for Model: ${model}`,
        async () => {
            const fileSources = [imageUrl1];
            const complexPrompt =
                'Analyze this image in detail. Describe the main elements, colors, and any text visible. Then, speculate about the context or purpose of this image.' +
                WORD_INCLUSION_PROMPT;
            const result: any = await llmInference.visionRequest(complexPrompt, fileSources, config, agent);
            expect(result).toBeTruthy();
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        `handles prompts with special characters and Unicode for Model: ${model}`,
        async () => {
            const fileSources = [imageUrl1];
            const specialCharsPrompt = 'Describe this image: 🌍🚀 こんにちは! 你好! مرحبا!' + WORD_INCLUSION_PROMPT;
            const result: any = await llmInference.visionRequest(specialCharsPrompt, fileSources, config, agent);
            expect(result).toBeTruthy();
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );
}

const models = [
    { provider: 'OpenAI', id: 'gpt-4o-mini' },
    { provider: 'AnthropicAI', id: 'claude-3-haiku-20240307' },
    { provider: 'GoogleAI', id: 'gemini-1.5-flash' },
];

for (const model of models) {
    describe(`LLM Vision Tests: ${model.provider} (${model.id})`, async () => {
        await runVisionTestCases(model.id);
    });
}
