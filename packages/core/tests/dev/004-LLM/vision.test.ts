import { describe, expect, it, vi } from 'vitest';
import config from '@sre/config';
import { SmythRuntime } from '@sre/index';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import Agent from '@sre/AgentManager/Agent.class';

// Mock Agent class to keep the test isolated from the actual Agent implementation
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => {
        // Inherit Agent.prototype for proper instanceof Agent checks
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

// @ts-ignore (Ignore required arguments, as we are using the mocked Agent)
let agent = new Agent();

const TIMEOUT = 30000;

function runVisionTestCases(model: string) {
    const config = {
        data: {
            model,
            maxTokens: 200,
        },
    };
    const llmHelper: LLMHelper = LLMHelper.load(model);

    const imageUrl1 = 'https://fastly.picsum.photos/id/478/536/354.jpg?hmac=adxYyHX8WcCfHkk07quT2s92fbC7vY2QttaeBztwxgI';
    const imageUrl2 = 'https://fastly.picsum.photos/id/1038/536/354.jpg?hmac=Hu6nao4zkSvq_pHo5pIssp8oYizJus3yfL956AXww70';
    const imageUrl3 = 'https://fastly.picsum.photos/id/533/536/354.jpg?hmac=jRXOQOhY0DMDE0jgxz4LsOlmfwO4keMU6sh258s8OIQ';

    function expectValidResponse(result: any) {
        expect(result).toBeDefined();
        expect(result).not.toBe('');
    }

    it(
        `runs a simple vision request with a single image for Model: ${model}`,
        async () => {
            const fileSources = [imageUrl1];
            const result: any = await llmHelper.visionRequest('What is in this image?', fileSources, config, agent);
            expectValidResponse(result);
        },
        TIMEOUT
    );

    it(
        `handles multiple images in a single request for Model: ${model}`,
        async () => {
            const fileSources = [imageUrl1, imageUrl2];
            const result: any = await llmHelper.visionRequest('Compare these two images', fileSources, config, agent);
            expectValidResponse(result);
        },
        TIMEOUT
    );

    it(
        `handles different image formats correctly for Model: ${model}`,
        async () => {
            const fileSources = [imageUrl1, imageUrl2, imageUrl3];
            const result: any = await llmHelper.visionRequest('Describe these images', fileSources, config, agent);
            expectValidResponse(result);
        },
        TIMEOUT
    );

    it(
        `handles invalid image files gracefully for Model: ${model}`,
        async () => {
            const fileSources = ['invalid-url'];
            await expect(llmHelper.visionRequest('What is in this image?', fileSources, config, agent)).rejects.toThrow();
        },
        TIMEOUT
    );

    it(
        `handles empty file sources array for Model: ${model}`,
        async () => {
            const fileSources = [];
            await expect(llmHelper.visionRequest('What is in this image?', fileSources, config, agent)).rejects.toThrow();
        },
        TIMEOUT
    );

    it(
        `handles complex prompts with images for Model: ${model}`,
        async () => {
            const fileSources = [imageUrl1];
            const complexPrompt =
                'Analyze this image in detail. Describe the main elements, colors, and any text visible. Then, speculate about the context or purpose of this image.';
            const result: any = await llmHelper.visionRequest(complexPrompt, fileSources, config, agent);
            expectValidResponse(result);
        },
        TIMEOUT
    );

    it(
        `handles prompts with special characters and Unicode for Model: ${model}`,
        async () => {
            const fileSources = [imageUrl1];
            const specialCharsPrompt = 'Describe this image: 🌍🚀 こんにちは! 你好! مرحبا!';
            const result: any = await llmHelper.visionRequest(specialCharsPrompt, fileSources, config, agent);
            expectValidResponse(result);
        },
        TIMEOUT
    );
}

const models = ['gpt-4o-mini', 'claude-3-5-sonnet-20240620', 'gemini-1.5-flash'];

for (const model of models) {
    describe(`LLM Vision Tests for Model: ${model}`, () => {
        runVisionTestCases(model);
    });
}
