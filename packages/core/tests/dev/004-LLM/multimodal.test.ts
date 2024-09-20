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

async function runMultimodalTestCases(model: string) {
    const config = {
        data: {
            model,
            maxTokens: 200,
        },
    };
    const llmInference: LLMInference = await LLMInference.load(model);

    const imageUrl1 = 'https://fastly.picsum.photos/id/478/536/354.jpg?hmac=adxYyHX8WcCfHkk07quT2s92fbC7vY2QttaeBztwxgI';
    const imageUrl2 = 'https://fastly.picsum.photos/id/1038/536/354.jpg?hmac=Hu6nao4zkSvq_pHo5pIssp8oYizJus3yfL956AXww70';
    const audioUrl = 'https://actions.google.com/sounds/v1/foley/play_in_pile_of_leaves.ogg';
    const videoUrl = 'https://storage.googleapis.com/generativeai-downloads/images/GreatRedSpot.mp4';
    const pdfUrl = 'https://file-examples.com/storage/fef44df12666d835ba71c24/2017/10/file-sample_150kB.pdf';

    function expectValidResponse(result: any) {
        expect(result).toBeDefined();
        expect(result).not.toBe('');
    }

    it(
        `runs a simple multimodal request with a single image for Model: ${model}`,
        async () => {
            const fileSources = [imageUrl1];
            const result: any = await llmInference.multimodalRequest('What is in this image?', fileSources, config, agent);
            expectValidResponse(result);
        },
        TIMEOUT
    );

    it(
        `handles multiple images in a single request for Model: ${model}`,
        async () => {
            const fileSources = [imageUrl1, imageUrl2];
            const result: any = await llmInference.multimodalRequest('Compare these two images', fileSources, config, agent);
            expectValidResponse(result);
        },
        TIMEOUT
    );

    it(
        `handles empty file sources array for Model: ${model}`,
        async () => {
            const fileSources = [];
            await expect(llmInference.multimodalRequest('Analyze this data', fileSources, config, agent)).rejects.toThrow();
        },
        TIMEOUT
    );

    it(
        `handles complex prompts with multiple file types for Model: ${model}`,
        async () => {
            const fileSources = [imageUrl1, audioUrl, pdfUrl];
            const complexPrompt =
                'Analyze these files in detail. Describe the visual elements in the image, the audio content, and the document content. Then, speculate about how they might be related.';
            const result: any = await llmInference.multimodalRequest(complexPrompt, fileSources, config, agent);
            expectValidResponse(result);
        },
        TIMEOUT
    );

    it(
        `handles prompts with special characters and Unicode for Model: ${model}`,
        async () => {
            const fileSources = [imageUrl1, audioUrl];
            const specialCharsPrompt = 'Describe these files: 🌍🚀 こんにちは! 你好! مرحبا!';
            const result: any = await llmInference.multimodalRequest(specialCharsPrompt, fileSources, config, agent);
            expectValidResponse(result);
        },
        TIMEOUT
    );

    it(
        `handles a mix of image and text files for Model: ${model}`,
        async () => {
            const fileSources = [imageUrl1, pdfUrl];
            const prompt = 'Compare the content of the image with the text file. Are they related?';
            const result: any = await llmInference.multimodalRequest(prompt, fileSources, config, agent);
            expectValidResponse(result);
        },
        TIMEOUT
    );

    it(
        `processes a video file correctly for Model: ${model}`,
        async () => {
            const fileSources = [videoUrl];
            const prompt = 'Describe the main events in this video.';
            const result: any = await llmInference.multimodalRequest(prompt, fileSources, config, agent);
            expectValidResponse(result);
        },
        TIMEOUT * 20 // 10 mins
    );

    it(
        `handles a combination of audio and image files for Model: ${model}`,
        async () => {
            const fileSources = [audioUrl, imageUrl1];
            const prompt = 'Is the audio describing the image? If not, how are they different?';
            const result: any = await llmInference.multimodalRequest(prompt, fileSources, config, agent);
            expectValidResponse(result);
        },
        TIMEOUT
    );

    it(
        `should throw error when there are video file with other file types for Model: ${model}`,
        async () => {
            const fileSources = [imageUrl1, audioUrl, videoUrl, pdfUrl];
            await expect(llmInference.multimodalRequest('Analyze these files', fileSources, config, agent)).rejects.toThrow();
        },
        TIMEOUT * 3 // 1:30 mins
    );
}

const models = ['gemini-1.5-flash'];

for (const model of models) {
    describe(`LLM Multimodal Tests for Model: ${model}`, async () => {
        await runMultimodalTestCases(model);
    });
}
