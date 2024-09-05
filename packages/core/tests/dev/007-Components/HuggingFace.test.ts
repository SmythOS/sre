import Agent from '@sre/AgentManager/Agent.class';
import HuggingFace from '@sre/Components/HuggingFace.class';
import LLMAssistant from '@sre/Components/LLMAssistant.class';
import { config, SmythRuntime } from '@sre/index';
import { delay } from '@sre/utils/date-time.utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import util from 'util';
import path from 'path';

//We need SRE to be loaded because LLMAssistant uses internal SRE functions
const sre = SmythRuntime.Instance.init({
    CLI: {
        Connector: 'CLI',
    },
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: config.env.AWS_S3_BUCKET_NAME || '',
            region: config.env.AWS_S3_REGION || '',
            accessKeyId: config.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: config.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
    Cache: {
        Connector: 'Redis',
        Settings: {
            hosts: config.env.REDIS_SENTINEL_HOSTS,
            name: config.env.REDIS_MASTER_NAME || '',
            password: config.env.REDIS_PASSWORD || '',
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

// Mock Agent class to keep the test isolated from the actual Agent implementation
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => {
        // Inherit Agent.prototype for proper instanceof Agent checks
        return Object.create(Agent.prototype, {
            id: { value: 'agent-123456' }, // used inside inferBinaryType()
            agentRuntime: { value: { debug: true } }, // used inside createComponentLogger()
        });
    });
    return { default: MockedAgent };
});

describe('HuggingFace Component', () => {
    beforeAll(() => {
        // check if the huggingface env variables are set. if not, inform the developer to set them
        if (!process.env.HUGGINGFACE_API_KEY) {
            throw new Error('HuggingFace API Key is not set. Please set the HUGGINGFACE_API_KEY environment variable to run this test.');
        }
    });

    it('prompt with a text input', async () => {
        // @ts-ignore
        const agent = new Agent();
        const hfComp = new HuggingFace();

        const output = await hfComp.process(
            {
                Text: 'A photo',
            },
            {
                data: {
                    accessToken: process.env.HUGGINGFACE_API_KEY,
                    desc: '',
                    disableCache: false,
                    displayName: 'fasttext-language-identification',
                    logoUrl: '',
                    modelName: 'facebook/fasttext-language-identification',
                    modelTask: 'text-classification',
                    name: 'facebook/fasttext-language-identification',
                    parameters: JSON.stringify({}),
                },
            },
            agent
        );

        const response = output.Output;

        expect(response).toBeDefined();
        expect(output._error).toBeUndefined();
    }, 60_000);

    it('prompt with a local binary input', async () => {
        // const imagePath = '../../data/avatar.png';
        const imagePath = path.resolve(__dirname, '../../data/avatar.png');

        const base64Str = await util.promisify(fs.readFile)(imagePath, { encoding: 'base64' });
        const base64Url = `data:image/png;base64,${base64Str}`;
        // @ts-ignore
        const agent = new Agent();
        const hfComp = new HuggingFace();

        const output = await hfComp.process(
            {
                Image: base64Url,
            },
            {
                data: {
                    accessToken: process.env.HUGGINGFACE_API_KEY,
                    desc: "Zero-shot image classification based on OpenAI's CLIP model using Vision Transformer with large patches.",
                    disableCache: false,
                    displayName: 'clip-vit-large-patch14',
                    logoUrl: '',
                    modelName: 'openai/clip-vit-large-patch14',
                    modelTask: 'zero-shot-image-classification',
                    name: 'openai/clip-vit-large-patch14',
                    parameters: JSON.stringify({
                        candidate_labels: ['woman', 'cat', 'dog'],
                    }),
                },
            },
            agent
        );

        const response = output.Output;

        expect(response).toBeDefined();
        expect(output._error).toBeUndefined();
    }, 60_000);

    it('prompt with a remote binary input', async () => {
        // @ts-ignore
        const agent = new Agent();
        const hfComp = new HuggingFace();

        const output = await hfComp.process(
            {
                Image: 'https://i.imgur.com/LY998xU.jpeg',
            },
            {
                data: {
                    accessToken: process.env.HUGGINGFACE_API_KEY,
                    desc: "Zero-shot image classification based on OpenAI's CLIP model using Vision Transformer with large patches.",
                    disableCache: false,
                    displayName: 'clip-vit-large-patch14',
                    logoUrl: '',
                    modelName: 'openai/clip-vit-large-patch14',
                    modelTask: 'zero-shot-image-classification',
                    name: 'openai/clip-vit-large-patch14',
                    parameters: JSON.stringify({
                        candidate_labels: ['dog', 'cat', 'lion'],
                    }),
                },
            },
            agent
        );

        const response = output.Output;

        expect(response).toBeDefined();
        expect(output._error).toBeUndefined();
    }, 60_000);
});
