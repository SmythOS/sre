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
                makeConfig('distilbert/distilbert-base-uncased-finetuned-sst-2-english', 'text-classification'),
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
        'tokenClassification — should return entity array with words',
        async () => {
            const output = await hfComp.process(
                { Text: 'My name is John and I live in London' },
                makeConfig('dslim/bert-base-NER', 'token-classification', {
                    aggregation_strategy: 'simple',
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
            const output = await hfComp.process({ Text: 'Hello world' }, makeConfig('Helsinki-NLP/opus-mt-en-fr', 'translation'), mockAgent);

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
                makeConfig('deepset/roberta-base-squad2', 'question-answering'),
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
                makeConfig('google/tapas-base-finetuned-wtq', 'table-question-answering'),
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
                makeConfig('bert-base-uncased', 'fill-mask'),
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
            const output = await hfComp.process({ Text: 'Hello world' }, makeConfig('facebook/bart-base', 'feature-extraction'), mockAgent);

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
                makeConfig('google/vit-base-patch16-224', 'image-classification'),
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
            const output = await hfComp.process({ Image: imageBase64Url }, makeConfig('facebook/detr-resnet-50', 'object-detection'), mockAgent);

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
                makeConfig('facebook/detr-resnet-50-panoptic', 'image-segmentation'),
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
                makeConfig('stabilityai/stable-diffusion-xl-base-1.0', 'text-to-image'),
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
    it.skip('text2textGeneration — no inference provider available', async () => {});
    it.skip('visualQuestionAnswering — no inference provider available', async () => {});
    it.skip('imageToText — no inference provider available', async () => {});
    it.skip('zeroShotImageClassification — no inference provider available', async () => {});
    it.skip('textToSpeech — no inference provider available', async () => {});

    // No audio test fixture available
    it.skip('automaticSpeechRecognition — no audio test fixture', async () => {});
    it.skip('audioToAudio — no audio test fixture', async () => {});
    it.skip('audioClassification — no audio test fixture', async () => {});

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
});
