import { setDefaultAutoSelectFamily } from 'net';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { TConnectorService } from '@sre/types/SRE.types';
import fs from 'fs';
import { ConnectorService, SmythRuntime, HuggingFace } from 'index';
import path from 'path';
import util from 'util';
import { beforeAll, describe, expect, it } from 'vitest';
import { TestAccountConnector } from '../../utils/TestConnectors';

// HF inference endpoints can be slow to resolve under IPv6 auto-selection
setDefaultAutoSelectFamily(false);

const imagePath = path.resolve(__dirname, '../../data/smythos.png');
const imageBlob = await util.promisify(fs.readFile)(imagePath);
const imageBase64Url = `data:image/png;base64,${imageBlob.toString('base64')}`;

const getApiKeyVaultKeyName = (): string => `{{KEY(HUGGINGFACE_API_KEY)}}`;

class CustomAccountConnector extends TestAccountConnector {
    public getCandidateTeam(candidate: IAccessCandidate): Promise<string | undefined> {
        if (candidate.id === 'agent-123456') return Promise.resolve('9');
        if (candidate.id === 'agent-654321') return Promise.resolve('5');
        return super.getCandidateTeam(candidate);
    }
}
ConnectorService.register(TConnectorService.Account, 'MyCustomAccountConnector', CustomAccountConnector);

SmythRuntime.Instance.init({
    CLI: { Connector: 'CLI' },
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: process.env.AWS_S3_BUCKET_NAME || '',
            region: process.env.AWS_S3_REGION || '',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
    Cache: { Connector: 'RAM', Settings: {} },
    AgentData: {
        Connector: 'Local',
        Settings: {
            devDir: './packages/core/tests/data/AgentData',
            prodDir: './packages/core/tests/data/AgentData',
        },
    },
    Vault: {
        Connector: 'JSONFileVault',
        Settings: { file: './packages/core/tests/data/vault.json' },
    },
    Account: { Connector: 'DummyAccount', Settings: {} },
});

const mockAgent = {
    id: 'agent-123456',
    teamId: 'default',
    agentRuntime: { debug: true },
    isKilled: () => false,
} as any;

const TIMEOUT = 90_000;

describe('HuggingFace Component — Integration', () => {
    let hfComp: HuggingFace;

    beforeAll(async () => {
        const vaultConnector = ConnectorService.getVaultConnector();
        const team = AccessCandidate.team('default');

        const apiKey = await vaultConnector
            .user(team)
            .get('HUGGINGFACE_API_KEY')
            .catch(() => {
                throw new Error('Failed to get HuggingFace API Key from vault. Please add HUGGINGFACE_API_KEY to vault.json.');
            });

        if (!apiKey) {
            throw new Error('HuggingFace API Key is not set in vault.json.');
        }

        hfComp = new HuggingFace();
    });

    function makeConfig(modelName: string, modelTask: string, parameters: Record<string, any> = {}) {
        return {
            data: {
                accessToken: getApiKeyVaultKeyName(),
                desc: '',
                disableCache: false,
                displayName: modelName.split('/').pop() || modelName,
                logoUrl: '',
                modelName,
                modelTask,
                name: modelName,
                parameters: JSON.stringify(parameters),
            },
        };
    }

    it(
        'chatCompletion (conversational) — should return a string response',
        async () => {
            const output = await hfComp.process(
                { Messages: [{ role: 'user', content: 'Say hello in one word.' }] },
                makeConfig('Qwen/Qwen3-32B', 'conversational', {
                    min_length: 1,
                    max_length: 50,
                    top_k: 50,
                    top_p: 0.9,
                    temperature: 0.3,
                    repetition_penalty: 1.2,
                    max_time: 60,
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(typeof output.Output).toBe('string');
            expect(output.Output.length).toBeGreaterThan(0);
        },
        TIMEOUT,
    );

    it(
        'textClassification — should return label/score array',
        async () => {
            const output = await hfComp.process(
                { Text: 'This is a wonderful day' },
                makeConfig('distilbert/distilbert-base-uncased-finetuned-sst-2-english', 'text-classification', {
                    top_k: 2,
                    function_to_apply: 'softmax',
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(Array.isArray(output.Output)).toBe(true);
            expect(output.Output.length).toBeGreaterThan(0);
            expect(output.Output[0]).toHaveProperty('label');
            expect(output.Output[0]).toHaveProperty('score');
        },
        TIMEOUT,
    );

    it(
        'text-generation (routed to chatCompletion via Hub API) — should return a string',
        async () => {
            const output = await hfComp.process(
                { Text: 'The capital of France is' },
                makeConfig('meta-llama/Meta-Llama-3-8B', 'text-generation', {
                    do_sample: true,
                    max_time: 60,
                    num_return_sequences: 1,
                    repetition_penalty: 1.1,
                    return_full_text: false,
                    temperature: 0.7,
                    max_new_tokens: 30,
                    top_k: 50,
                    top_p: 0.9,
                    truncate: 512,
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(typeof output.Output).toBe('string');
            expect(output.Output.length).toBeGreaterThan(0);
        },
        TIMEOUT,
    );

    it(
        'text-generation — new v4 TGI params (seed, watermark, typical_p, grammar)',
        async () => {
            const output = await hfComp.process(
                { Text: 'The meaning of life is' },
                makeConfig('meta-llama/Meta-Llama-3-8B', 'text-generation', {
                    max_new_tokens: 30,
                    temperature: 0.7,
                    top_p: 0.9,
                    top_k: 50,
                    frequency_penalty: 0,
                    repetition_penalty: 1.1,
                    do_sample: true,
                    seed: 42,
                    return_full_text: false,
                    watermark: false,
                    details: false,
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(typeof output.Output).toBe('string');
            expect(output.Output.length).toBeGreaterThan(0);
        },
        TIMEOUT,
    );

    it(
        'tokenClassification — should return entity array with words',
        async () => {
            const output = await hfComp.process(
                { Text: 'My name is John and I live in London' },
                makeConfig('dslim/bert-base-NER', 'token-classification', {
                    aggregation_strategy: 'simple',
                    ignore_labels: ['O'],
                    stride: 0,
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(Array.isArray(output.Output)).toBe(true);
            expect(output.Output.length).toBeGreaterThan(0);
            expect(output.Output[0]).toHaveProperty('entity_group');
            expect(output.Output[0]).toHaveProperty('word');
            expect(output.Output[0]).toHaveProperty('score');
        },
        TIMEOUT,
    );

    it(
        'translation — should return translated text string',
        async () => {
            const output = await hfComp.process(
                { Text: 'Hello world' },
                makeConfig('Helsinki-NLP/opus-mt-en-fr', 'translation', {
                    clean_up_tokenization_spaces: true,
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(typeof output.Output).toBe('string');
            expect(output.Output.length).toBeGreaterThan(0);
        },
        TIMEOUT,
    );

    it(
        'summarization — should return summary text string',
        async () => {
            const longText =
                'The tower is 324 metres (1,063 ft) tall, about the same height as an 81-storey building, ' +
                'and the tallest structure in Paris. Its base is square, measuring 125 metres (410 ft) on each side. ' +
                'During its construction, the Eiffel Tower surpassed the Washington Monument to become the tallest ' +
                'man-made structure in the world, a title it held for 41 years until the Chrysler Building in New York ' +
                'City was finished in 1930.';

            const output = await hfComp.process(
                { Text: longText },
                makeConfig('facebook/bart-large-cnn', 'summarization', {
                    min_length: 10,
                    max_length: 60,
                    top_k: 50,
                    top_p: 0.9,
                    temperature: 0.7,
                    repetition_penalty: 1.2,
                    max_time: 60,
                    clean_up_tokenization_spaces: true,
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(typeof output.Output).toBe('string');
            expect(output.Output.length).toBeGreaterThan(0);
            expect(output.Output.length).toBeLessThan(longText.length);
        },
        TIMEOUT,
    );

    it(
        'questionAnswering — should return an answer string',
        async () => {
            const output = await hfComp.process(
                {
                    Question: 'What is the capital of France?',
                    Context: 'France is a country in Europe. The capital of France is Paris. Paris is known for the Eiffel Tower.',
                },
                makeConfig('deepset/roberta-base-squad2', 'question-answering', {
                    top_k: 1,
                    max_answer_len: 50,
                    handle_impossible_answer: false,
                    align_to_words: true,
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(typeof output.Output).toBe('string');
            expect(output.Output.toLowerCase()).toContain('paris');
        },
        TIMEOUT,
    );

    it(
        'tableQuestionAnswering — should return an answer string',
        async () => {
            const output = await hfComp.process(
                {
                    Query: 'How many stars does the repository smythos have?',
                    Table: JSON.stringify({
                        Repository: ['smythos', 'transformers', 'datasets'],
                        Stars: ['100', '36542', '4512'],
                        Contributors: ['10', '400', '150'],
                    }),
                },
                makeConfig('google/tapas-base-finetuned-wtq', 'table-question-answering', {
                    sequential: false,
                    truncation: true,
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(typeof output.Output).toBe('string');
            expect(output.Output.length).toBeGreaterThan(0);
        },
        TIMEOUT,
    );

    it(
        'fillMask — should return token predictions array',
        async () => {
            const output = await hfComp.process(
                { Text: 'The capital of France is [MASK].' },
                makeConfig('bert-base-uncased', 'fill-mask', {
                    top_k: 3,
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(Array.isArray(output.Output)).toBe(true);
            expect(output.Output.length).toBeGreaterThan(0);
            expect(output.Output[0]).toHaveProperty('sequence');
            expect(output.Output[0]).toHaveProperty('score');
            expect(output.Output[0]).toHaveProperty('token_str');
        },
        TIMEOUT,
    );

    it(
        'sentenceSimilarity — should return similarity scores array',
        async () => {
            const output = await hfComp.process(
                {
                    Source_sentence: 'That is a happy person',
                    Sentences: JSON.stringify(['That is a happy dog', 'That is a very happy person', 'Today is a sunny day']),
                },
                makeConfig('sentence-transformers/all-MiniLM-L6-v2', 'sentence-similarity'),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(Array.isArray(output.Output)).toBe(true);
            expect(output.Output.length).toBeGreaterThan(0);
            expect(typeof output.Output[0]).toBe('number');
        },
        TIMEOUT,
    );

    it(
        'zeroShotClassification — should return label/score array',
        async () => {
            const output = await hfComp.process(
                { Text: 'I love this product!' },
                makeConfig('facebook/bart-large-mnli', 'zero-shot-classification', {
                    candidate_labels: ['positive', 'negative', 'neutral'],
                    multi_label: false,
                    hypothesis_template: 'This text expresses a {} sentiment.',
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(Array.isArray(output.Output)).toBe(true);
            expect(output.Output.length).toBeGreaterThan(0);
            expect(output.Output[0]).toHaveProperty('label');
            expect(output.Output[0]).toHaveProperty('score');
        },
        TIMEOUT,
    );

    it(
        'featureExtraction — should return embeddings array',
        async () => {
            const output = await hfComp.process(
                { Text: 'Hello world' },
                makeConfig('facebook/bart-base', 'feature-extraction', {
                    normalize: true,
                    truncate: true,
                    truncation_direction: 'right',
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            // Feature extraction returns nested arrays of numbers (embeddings)
            expect(output.Output).toBeDefined();
        },
        TIMEOUT,
    );

    // ==================== Vision Tasks ====================

    it(
        'imageClassification — should return label/score array',
        async () => {
            const output = await hfComp.process(
                { Image: imageBase64Url },
                makeConfig('google/vit-base-patch16-224', 'image-classification', {
                    top_k: 5,
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(Array.isArray(output.Output)).toBe(true);
            expect(output.Output.length).toBeGreaterThan(0);
            expect(output.Output[0]).toHaveProperty('label');
            expect(output.Output[0]).toHaveProperty('score');
        },
        TIMEOUT,
    );

    it(
        'objectDetection — should return detections array',
        async () => {
            const output = await hfComp.process(
                { Image: imageBase64Url },
                makeConfig('facebook/detr-resnet-50', 'object-detection', {
                    threshold: 0.8,
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(Array.isArray(output.Output)).toBe(true);
            if (output.Output.length > 0) {
                expect(output.Output[0]).toHaveProperty('label');
                expect(output.Output[0]).toHaveProperty('box');
            }
        },
        TIMEOUT,
    );

    it(
        'imageSegmentation — should return segments array',
        async () => {
            // Use a real-world COCO dataset photo (cats on a couch) so the panoptic model returns segments
            const cocoImageUrl = 'http://images.cocodataset.org/val2017/000000039769.jpg';
            const output = await hfComp.process(
                { Image: cocoImageUrl },
                makeConfig('facebook/detr-resnet-50-panoptic', 'image-segmentation', {
                    subtask: 'panoptic',
                    threshold: 0.9,
                    overlap_mask_area_threshold: 0.5,
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(Array.isArray(output.Output)).toBe(true);
            expect(output.Output.length).toBeGreaterThan(0);
            expect(output.Output[0]).toHaveProperty('label');
            expect(output.Output[0]).toHaveProperty('mask');
        },
        TIMEOUT,
    );

    it(
        'textToImage — should return an image output',
        async () => {
            const output = await hfComp.process(
                { Text: 'A simple red circle on a white background' },
                makeConfig('stabilityai/stable-diffusion-xl-base-1.0', 'text-to-image', {
                    num_inference_steps: 20,
                    guidance_scale: 7.5,
                    width: 512,
                    height: 512,
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(output.Output).toBeDefined();
        },
        TIMEOUT,
    );

    it(
        'imageToImage — should return a transformed image output',
        async () => {
            const output = await hfComp.process(
                { Image: imageBase64Url },
                makeConfig('PixelSmile/PixelSmile', 'image-to-image', {
                    prompt: 'pixel art style',
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(output.Output).toBeDefined();
        },
        TIMEOUT,
    );

    it(
        'imageToText — should return a text description of the image',
        async () => {
            const output = await hfComp.process({ Image: imageBase64Url }, makeConfig('zai-org/GLM-OCR', 'image-to-text'), mockAgent);

            expect(output._error).toBeUndefined();
            expect(typeof output.Output).toBe('string');
            expect(output.Output.length).toBeGreaterThan(0);
        },
        TIMEOUT,
    );

    it(
        'textToSpeech — should return an audio output',
        async () => {
            const output = await hfComp.process(
                { Text: 'Hello, this is a test of text to speech.' },
                makeConfig('hexgrad/Kokoro-82M', 'text-to-speech'),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(output.Output).toBeDefined();
        },
        TIMEOUT,
    );

    // ==================== Parameter Handling ====================

    it(
        'chatCompletion — should handle remapped legacy HF params (conversational)',
        async () => {
            const output = await hfComp.process(
                { Messages: [{ role: 'user', content: 'Say hi in one word.' }] },
                makeConfig('Qwen/Qwen3-32B', 'conversational', {
                    // Old conversational params (pre-migration)
                    min_length: 1,
                    max_length: 50,
                    top_k: 50,
                    top_p: 0.9,
                    temperature: 0.3,
                    repetition_penalty: 1.2,
                    max_time: 60,
                    // Old text-generation params that may leak into conversational configs
                    max_new_tokens: 20,
                    do_sample: true,
                    return_full_text: false,
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(typeof output.Output).toBe('string');
            expect(output.Output.length).toBeGreaterThan(0);
        },
        TIMEOUT,
    );

    // ==================== Error Handling ====================

    it('should return error when no access token is provided', async () => {
        const output = await hfComp.process(
            { Text: 'Hello' },
            {
                data: {
                    accessToken: '',
                    modelName: 'some-model',
                    modelTask: 'text-classification',
                    name: 'test',
                    displayName: 'test',
                    desc: '',
                    parameters: '{}',
                },
            },
            mockAgent,
        );
        expect(output._error).toBeDefined();
    }, 10_000);

    it('should return error when no task is provided', async () => {
        const output = await hfComp.process(
            { Text: 'Hello' },
            {
                data: {
                    accessToken: 'dummy-token',
                    modelName: 'some-model',
                    modelTask: '',
                    name: 'test',
                    displayName: 'test',
                    desc: '',
                    parameters: '{}',
                },
            },
            mockAgent,
        );
        expect(output._error).toBeDefined();
    }, 10_000);

    it('should return error when no model is provided', async () => {
        const output = await hfComp.process(
            { Text: 'Hello' },
            {
                data: {
                    accessToken: 'dummy-token',
                    modelName: '',
                    modelTask: 'text-classification',
                    name: 'test',
                    displayName: 'test',
                    desc: '',
                    parameters: '{}',
                },
            },
            mockAgent,
        );
        expect(output._error).toBeDefined();
    }, 10_000);

    it('should return error when no input is provided', async () => {
        const output = await hfComp.process({}, makeConfig('bert-base-uncased', 'text-classification'), mockAgent);
        expect(output._error).toBeDefined();
    }, 10_000);

    // ==================== New Parameter Tests (v4 SDK) ====================

    it(
        'chatCompletion (conversational) — new v4 params (seed, logprobs, response_format)',
        async () => {
            const output = await hfComp.process(
                { Messages: [{ role: 'user', content: 'What is 2+2? Answer with just the number.' }] },
                makeConfig('Qwen/Qwen3-32B', 'conversational', {
                    max_tokens: 50,
                    temperature: 0.1,
                    top_p: 0.9,
                    seed: 42,
                    logprobs: false,
                    frequency_penalty: 0,
                    presence_penalty: 0,
                    stop: ['\n'],
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(typeof output.Output).toBe('string');
            expect(output.Output.length).toBeGreaterThan(0);
        },
        TIMEOUT,
    );

    it(
        'summarization — new v4 params (truncation enum, generate_parameters)',
        async () => {
            const longText =
                'The tower is 324 metres (1,063 ft) tall, about the same height as an 81-storey building, ' +
                'and the tallest structure in Paris. Its base is square, measuring 125 metres (410 ft) on each side. ' +
                'During its construction, the Eiffel Tower surpassed the Washington Monument to become the tallest ' +
                'man-made structure in the world, a title it held for 41 years until the Chrysler Building in New York ' +
                'City was finished in 1930.';

            const output = await hfComp.process(
                { Text: longText },
                makeConfig('facebook/bart-large-cnn', 'summarization', {
                    clean_up_tokenization_spaces: true,
                    truncation: 'longest_first',
                    generate_parameters: {
                        max_new_tokens: 60,
                        temperature: 0.7,
                    },
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(typeof output.Output).toBe('string');
            expect(output.Output.length).toBeGreaterThan(0);
            expect(output.Output.length).toBeLessThan(longText.length);
        },
        TIMEOUT,
    );

    it(
        'translation — new v4 params (truncation enum, generate_parameters)',
        async () => {
            const output = await hfComp.process(
                { Text: 'Hello world' },
                makeConfig('Helsinki-NLP/opus-mt-en-fr', 'translation', {
                    clean_up_tokenization_spaces: true,
                    truncation: 'do_not_truncate',
                    generate_parameters: {
                        max_new_tokens: 50,
                    },
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(typeof output.Output).toBe('string');
            expect(output.Output.length).toBeGreaterThan(0);
        },
        TIMEOUT,
    );

    it(
        'imageToImage — new v4 params (target_size)',
        async () => {
            const output = await hfComp.process(
                { Image: imageBase64Url },
                makeConfig('PixelSmile/PixelSmile', 'image-to-image', {
                    prompt: 'pixel art style',
                    target_size: { width: 256, height: 256 },
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(output.Output).toBeDefined();
        },
        TIMEOUT,
    );

    it(
        'textToVideo — should return a video output',
        async () => {
            const output = await hfComp.process(
                { Text: 'A cat walking on grass' },
                makeConfig('Lightricks/LTX-Video', 'text-to-video', {
                    num_inference_steps: 10,
                    guidance_scale: 7.5,
                    seed: 42,
                }),
                mockAgent,
            );

            expect(output._error).toBeUndefined();
            expect(output.Output).toBeDefined();
        },
        TIMEOUT,
    );

    // ==================== Skipped Tests ====================

    // No inference provider available for these models in @huggingface/inference v4
    it.skip('documentQuestionAnswering — no inference provider available', async () => {});
    it.skip('text2textGeneration — no inference provider available', async () => {});
    it.skip('visualQuestionAnswering — no inference provider available', async () => {});
    it.skip('zeroShotImageClassification — no inference provider available', async () => {});

    // openai/whisper-large-v3 routes to fal-ai provider, which rejects base64 data URLs
    // in its audio_url field (SDK bug). Workaround requires passing `provider: "hf-inference"`
    // as a top-level arg, which the component doesn't currently support.
    it.skip('automaticSpeechRecognition — fal-ai provider rejects base64 data URLs', async () => {});
    it.skip('audioToAudio — no audio test fixture', async () => {});
    it.skip('audioClassification — no audio test fixture', async () => {});
});
