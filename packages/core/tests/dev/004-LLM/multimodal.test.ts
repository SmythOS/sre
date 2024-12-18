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

async function runMultimodalTestCases(model: string) {
    const config = {
        data: {
            model,
            maxTokens: 200,
        },
    };
    const llmInference: LLMInference = await LLMInference.getInstance(model);

    const imageUrl1 = 'https://images.unsplash.com/photo-1721332155637-8b339526cf4c?q=10&w=300';
    const imageUrl2 = 'https://plus.unsplash.com/premium_photo-1732410903106-3379bbe6e9db?q=10&w=300';
    const audioUrl = 'https://actions.google.com/sounds/v1/foley/play_in_pile_of_leaves.ogg';
    const videoUrl = 'https://storage.googleapis.com/generativeai-downloads/images/GreatRedSpot.mp4';
    const pdfUrl = 'https://www.princexml.com/samples/invoice/invoicesample.pdf';

    it(
        `runs a simple multimodal request with a single image for Model: ${model}`,
        async () => {
            const prompt = 'What is in this image?' + WORD_INCLUSION_PROMPT;
            const fileSources = [imageUrl1];
            const result: any = await llmInference.multimodalRequest(prompt, fileSources, config, agent);
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(20);
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        `handles multiple images in a single request for Model: ${model}`,
        async () => {
            const prompt = 'Compare these two images' + WORD_INCLUSION_PROMPT;
            const fileSources = [imageUrl1, imageUrl2];
            const result: any = await llmInference.multimodalRequest(prompt, fileSources, config, agent);
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(20);
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
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
            const complexPrompt =
                'IMPORTANT INSTRUCTION: First include the word "' +
                LLM_OUTPUT_VALIDATOR +
                '" in your response.\n\n' +
                'Then analyze these files in detail. Describe the visual elements in the image, the audio content, and the document content. Then, speculate about how they might be related.' +
                WORD_INCLUSION_PROMPT;
            const fileSources = [imageUrl1, audioUrl, pdfUrl];
            const result: any = await llmInference.multimodalRequest(complexPrompt, fileSources, config, agent);
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(20);
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT * 5
    );

    it(
        `handles prompts with special characters and Unicode for Model: ${model}`,
        async () => {
            const specialCharsPrompt = 'Describe these files: 🌍🚀 こんにちは! 你好! مرحبا!' + WORD_INCLUSION_PROMPT;
            const fileSources = [imageUrl1, audioUrl];
            const result: any = await llmInference.multimodalRequest(specialCharsPrompt, fileSources, config, agent);
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(20);
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        `handles a mix of image and text files for Model: ${model}`,
        async () => {
            const prompt = 'Compare the content of the image with the text file. Are they related?' + WORD_INCLUSION_PROMPT;
            const fileSources = [imageUrl1, pdfUrl];
            const result: any = await llmInference.multimodalRequest(prompt, fileSources, config, agent);
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(20);
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT * 2
    );

    it(
        `processes a video file correctly for Model: ${model}`,
        async () => {
            const prompt = 'Describe the main events in this video.' + WORD_INCLUSION_PROMPT;
            const fileSources = [videoUrl];
            const result: any = await llmInference.multimodalRequest(prompt, fileSources, config, agent);
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(20);
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT * 30 // 15 mins, it takes long time to process video file
    );

    it(
        `handles a combination of audio and image files for Model: ${model}`,
        async () => {
            const prompt = 'Is the audio describing the image? If not, how are they different?' + WORD_INCLUSION_PROMPT;
            const fileSources = [audioUrl, imageUrl1];
            const result: any = await llmInference.multimodalRequest(prompt, fileSources, config, agent);
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(20);
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        `should throw error when there are video file with other file types for Model: ${model}`,
        async () => {
            const fileSources = [imageUrl1, audioUrl, videoUrl, pdfUrl];
            await expect(llmInference.multimodalRequest('Analyze these files', fileSources, config, agent)).rejects.toThrow();
        },
        TIMEOUT * 20 // 10 mins
    );
}

const models = [{ provider: 'GoogleAI', id: 'gemini-1.5-flash' }];

for (const model of models) {
    describe(`LLM Multimodal Tests: ${model.provider} (${model.id})`, async () => {
        await runMultimodalTestCases(model.id);
    });
}
