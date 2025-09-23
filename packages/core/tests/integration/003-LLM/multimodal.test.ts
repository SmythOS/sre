import { Conversation } from '@sre/helpers/Conversation.helper';
import fs from 'fs';
import { describe, expect, it } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { testData } from '../../utils/test-data-manager';

setupSRE();

const TIMEOUT = 30000;
const LLM_OUTPUT_VALIDATOR = 'Yohohohooooo!';
const WORD_INCLUSION_PROMPT = `\nIMPORTANT : The response should start with "${LLM_OUTPUT_VALIDATOR}".`;

function runMultimodalTestCases(model: string) {
    const imageUrl1 = 'https://images.unsplash.com/photo-1721332155637-8b339526cf4c?q=10&w=300';
    const imageUrl2 = 'https://plus.unsplash.com/premium_photo-1732410903106-3379bbe6e9db?q=10&w=300';
    const audioUrl = 'https://actions.google.com/sounds/v1/foley/play_in_pile_of_leaves.ogg';
    const videoUrl = 'https://storage.googleapis.com/generativeai-downloads/images/GreatRedSpot.mp4';
    const pdfUrl = 'https://www.princexml.com/samples/invoice/invoicesample.pdf';

    it(
        `runs a simple multimodal request with a single image for Model: ${model}`,
        async () => {
            const spec = JSON.parse(fs.readFileSync(testData.getDataPath('AgentData/unit-tests-agent-randnum-randwords.smyth'), 'utf8'));
            const conv = new Conversation(model, spec);

            const prompt = 'What is in this image?' + WORD_INCLUSION_PROMPT;
            const fileSources = [imageUrl1];
            const result: any = await conv.prompt({ message: prompt, files: fileSources });
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(20);
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        `handles multiple images in a single request for Model: ${model}`,
        async () => {
            const spec = JSON.parse(fs.readFileSync(testData.getDataPath('AgentData/unit-tests-agent-randnum-randwords.smyth'), 'utf8'));
            const conv = new Conversation(model, spec);

            const prompt = 'Compare these two images' + WORD_INCLUSION_PROMPT;
            const fileSources = [imageUrl1, imageUrl2];
            const result: any = await conv.prompt({ message: prompt, files: fileSources });
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(20);
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        `handles empty file sources array for Model: ${model}`,
        async () => {
            const spec = JSON.parse(fs.readFileSync(testData.getDataPath('AgentData/unit-tests-agent-randnum-randwords.smyth'), 'utf8'));
            const conv = new Conversation(model, spec);

            const fileSources = [];
            const result: any = await conv.prompt({ message: 'Analyze this data', files: fileSources });
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(20);
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        `handles complex prompts with multiple file types for Model: ${model}`,
        async () => {
            const spec = JSON.parse(fs.readFileSync(testData.getDataPath('AgentData/unit-tests-agent-randnum-randwords.smyth'), 'utf8'));
            const conv = new Conversation(model, spec);

            const complexPrompt =
                'IMPORTANT INSTRUCTION: First include the word "' +
                LLM_OUTPUT_VALIDATOR +
                '" in your response.\n\n' +
                'Then analyze these files in detail. Describe the visual elements in the image, the audio content, and the document content. Then, speculate about how they might be related.' +
                WORD_INCLUSION_PROMPT;
            const fileSources = [imageUrl1, audioUrl, pdfUrl];
            const result: any = await conv.prompt({ message: complexPrompt, files: fileSources });
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(20);
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT * 5
    );

    it(
        `handles prompts with special characters and Unicode for Model: ${model}`,
        async () => {
            const spec = JSON.parse(fs.readFileSync(testData.getDataPath('AgentData/unit-tests-agent-randnum-randwords.smyth'), 'utf8'));
            const conv = new Conversation(model, spec);

            const specialCharsPrompt = 'Describe these files: 🌍🚀 こんにちは! 你好! مرحبا!' + WORD_INCLUSION_PROMPT;
            const fileSources = [imageUrl1, audioUrl];
            const result: any = await conv.prompt({ message: specialCharsPrompt, files: fileSources });
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(20);
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        `handles a mix of image and text files for Model: ${model}`,
        async () => {
            const spec = JSON.parse(fs.readFileSync(testData.getDataPath('AgentData/unit-tests-agent-randnum-randwords.smyth'), 'utf8'));
            const conv = new Conversation(model, spec);

            const prompt = 'Compare the content of the image with the text file. Are they related?' + WORD_INCLUSION_PROMPT;
            const fileSources = [imageUrl1, pdfUrl];
            const result: any = await conv.prompt({ message: prompt, files: fileSources });
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(20);
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT * 2
    );

    it(
        `processes a video file correctly for Model: ${model}`,
        async () => {
            const spec = JSON.parse(fs.readFileSync(testData.getDataPath('AgentData/unit-tests-agent-randnum-randwords.smyth'), 'utf8'));
            const conv = new Conversation(model, spec);

            const prompt = 'Describe the main events in this video.' + WORD_INCLUSION_PROMPT;
            const fileSources = [videoUrl];
            const result: any = await conv.prompt({ message: prompt, files: fileSources });
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(20);
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT * 30 // 15 mins, it takes long time to process video file
    );

    it(
        `handles a combination of audio and image files for Model: ${model}`,
        async () => {
            const spec = JSON.parse(fs.readFileSync(testData.getDataPath('AgentData/unit-tests-agent-randnum-randwords.smyth'), 'utf8'));
            const conv = new Conversation(model, spec);

            const prompt = 'Is the audio describing the image? If not, how are they different?' + WORD_INCLUSION_PROMPT;
            const fileSources = [audioUrl, imageUrl1];
            const result: any = await conv.prompt({ message: prompt, files: fileSources });
            expect(result).toBeTruthy();
            expect(result.length).toBeGreaterThan(20);
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT
    );

    it(
        `should throw error when there are video file with other file types for Model: ${model}`,
        async () => {
            const spec = JSON.parse(fs.readFileSync(testData.getDataPath('AgentData/unit-tests-agent-randnum-randwords.smyth'), 'utf8'));
            const conv = new Conversation(model, spec);

            const fileSources = [imageUrl1, audioUrl, videoUrl, pdfUrl];
            await expect(conv.prompt({ message: 'Analyze these files', files: fileSources })).rejects.toThrow();
        },
        TIMEOUT * 20 // 10 mins
    );
}

const models = [
    //{ provider: 'OpenAI', id: 'gpt-4o-mini' },
    //{ provider: 'Anthropic', id: 'claude-3-5-haiku' },
    { provider: 'GoogleAI', id: 'gemini-1.5-flash' },
];

for (const model of models) {
    describe(`LLM Multimodal Tests: ${model.provider} (${model.id})`, async () => {
        runMultimodalTestCases(model.id);
    });
}
