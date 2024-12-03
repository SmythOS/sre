import Agent from '@sre/AgentManager/Agent.class';
import HuggingFace from '@sre/Components/HuggingFace.class';
import LLMAssistant from '@sre/Components/LLMAssistant.class';
import { config, ConnectorService, SmythRuntime } from '@sre/index';
import { delay } from '@sre/utils/date-time.utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import util from 'util';
import path from 'path';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { HfInference, textClassification, zeroShotClassification, zeroShotImageClassification } from '@huggingface/inference';
import { TestAccountConnector } from '../../utils/TestConnectors';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { TConnectorService } from '@sre/types/SRE.types';

const imagePath = path.resolve(__dirname, '../../data/avatar.png');
const imageBlob = await util.promisify(fs.readFile)(imagePath);

// Specific getter for HuggingFace API key
const getApiKeyVaultKeyName = (): string => {
    // const apiKey = process.env.__TEST__HUGGINGFACE_API_KEY;
    // if (!apiKey) {
    //     throw new Error('Zapier testing API Key is not set. Please set the __TEST__HUGGINGFACE_API_KEY environment variable to run this test.');
    // }
    // // return apiKey;
    return `{{KEY(HUGGINGFACE_API_KEY)}}`;
};

class CustomAccountConnector extends TestAccountConnector {
    public getCandidateTeam(candidate: IAccessCandidate): Promise<string | undefined> {
        if (candidate.id === 'agent-123456') {
            return Promise.resolve('9');
        } else if (candidate.id === 'agent-654321') {
            return Promise.resolve('5');
        }

        return super.getCandidateTeam(candidate);
    }
}
ConnectorService.register(TConnectorService.Account, 'MyCustomAccountConnector', CustomAccountConnector);

// We need SRE to be loaded because LLMAssistant uses internal SRE functions
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
    Account: {
        Connector: 'DummyAccount',
        Settings: {},
    },
});

// Mock Agent class to keep the test isolated from the actual Agent implementation
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => ({
        id: 'agent-123456',
        teamId: 'default',
        agentRuntime: { debug: true }, // used inside createComponentLogger()
    }));
    return { default: MockedAgent };
});

vi.mock('@huggingface/inference', async () => {
    const originalHfInference = (await vi.importActual<typeof import('@huggingface/inference')>('@huggingface/inference')).HfInference;

    return {
        HfInference: vi.fn().mockImplementation((apiKey) => {
            const hfInference = new originalHfInference(apiKey);
            return {
                // dummy blob of a png image
                textToImage: vi.fn().mockResolvedValue(new Blob([imageBlob], { type: 'image/png' })),
                zeroShotClassification: hfInference.zeroShotClassification.bind(hfInference),
                zeroShotImageClassification: hfInference.zeroShotImageClassification.bind(hfInference),
                textClassification: hfInference.textClassification.bind(hfInference),
                textGeneration: hfInference.textGeneration.bind(hfInference),
                objectDetection: hfInference.objectDetection.bind(hfInference),
                accessToken: apiKey,
                custom: true,
            };
        }),
    };
});

describe('HuggingFace Component', () => {
    beforeAll(async () => {
        // This will throw an error if the API key is not set
        const vaultConnector = ConnectorService.getVaultConnector();
        const team = AccessCandidate.team('default');

        const apiKey = await vaultConnector
            .user(team)
            .get('HUGGINGFACE_API_KEY')
            .catch((e) => {
                console.log(e);
                throw new Error('Failed to get HuggingFace API Key from vault. Please add HUGGINGFACE_API_KEY to your vault.');
            });

        if (!apiKey) {
            throw new Error('HuggingFace testing API Key is not set. Please set the key in vault.json to run this test.');
        }
    });

    it('should pass prompt with a text input', async () => {
        // @ts-ignore
        const agent = new Agent();
        const hfComp = new HuggingFace();

        const output = await hfComp.process(
            {
                Text: 'A photo',
            },
            {
                data: {
                    accessToken: getApiKeyVaultKeyName(),
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

    it('should pass prompt with a local binary input', async () => {
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
                    accessToken: getApiKeyVaultKeyName(),
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

    it('should pass prompt with a remote binary input', async () => {
        // @ts-ignore
        const agent = new Agent();
        const hfComp = new HuggingFace();

        const output = await hfComp.process(
            {
                Image: 'https://i.imgur.com/LY998xU.jpeg',
            },
            {
                data: {
                    accessToken: getApiKeyVaultKeyName(),
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

    it('should return a binary output with a smythfs:// uri', async () => {
        // vi.mock('@huggingface/inference', () => ({
        //     HfInference: vi.fn().mockImplementation(() => ({
        //         // dummy blob of a png image
        //         textToImage: vi.fn().mockResolvedValue(new Blob()),
        //     })),
        // }));

        // @ts-ignore
        const agent = new Agent();
        const hfComp = new HuggingFace();

        const output = await hfComp.process(
            {
                Text: 'anime artwork, anime style',
            },
            {
                data: {
                    accessToken: getApiKeyVaultKeyName(),
                    desc: '',
                    disableCache: false,
                    displayName: 'aipicasso/emi',
                    logoUrl: '',
                    modelName: 'aipicasso/emi',
                    modelTask: 'text-to-image',
                    name: 'aipicasso/emi',
                    parameters: JSON.stringify({}),
                },
            },
            agent
        );

        const response = output.Output;

        expect(output._error).toBeUndefined();
        expect(response).toBeDefined();

        const previewUrl = response?.url;
        expect(previewUrl).toBeDefined();
        // expect(previewUrl, 'The output should be a valid URL to an image file').toMatch(/^https:\/\/.*\.(jpg|jpeg|png|gif)$/);

        // should match: smythfs://<teamId>.team/<candidateId>/_temp/<filename>
        expect(previewUrl, 'The output should be a valid SmythFS URI that points to the image file').toMatch(/^smythfs:\/\/.*\.team\/.*\/_temp\/.*$/);

        expect(response).toBeDefined();
        expect(output._error).toBeUndefined();
    }, 90_000);

    it('should corectly pass a binary HuggingFace ouptut to another binary HuggingFace input', async () => {
        // @ts-ignore
        const agent = new Agent();
        const hfComp = new HuggingFace();

        const output1 = await hfComp.process(
            {
                Text: 'anime artwork, anime style',
            },
            {
                data: {
                    accessToken: getApiKeyVaultKeyName(),
                    desc: '',
                    disableCache: false,
                    displayName: 'aipicasso/emi',
                    logoUrl: '',
                    modelName: 'aipicasso/emi',
                    modelTask: 'text-to-image',
                    name: 'aipicasso/emi',
                    parameters: JSON.stringify({}),
                },
            },
            agent
        );

        const response1 = output1.Output;

        expect(output1._error).toBeUndefined();
        expect(response1).toBeDefined();

        const previewUrl = response1?.url;
        expect(previewUrl).toBeDefined();
        // expect(previewUrl, 'The output should be a valid URL to an image file').toMatch(/^https:\/\/.*\.(jpg|jpeg|png|gif)$/);

        // should match: smythfs://<teamId>.team/<candidateId>/_temp/<filename>
        expect(previewUrl, 'The output should be a valid SmythFS URI that points to the image file').toMatch(/^smythfs:\/\/.*\.team\/.*\/_temp\/.*$/);

        expect(response1).toBeDefined();
        expect(output1._error).toBeUndefined();

        const output2 = await hfComp.process(
            {
                Image: response1,
            },
            {
                data: {
                    accessToken: getApiKeyVaultKeyName(),
                    disableCache: false,
                    parameters: JSON.stringify({}),
                    modelName: 'facebook/detr-resnet-50',
                    modelTask: 'object-detection',
                    inputConfig: '{"Image":"URL | base64 | file | SmythFileObject"}',
                    name: 'facebook/detr-resnet-50',
                    displayName: 'detr-resnet-50',
                    desc: 'An object detection model developed by Facebook using a ResNet-50 backbone network architecture.',
                    logoUrl:
                        'https://aeiljuispo.cloudimg.io/v7/https://cdn-uploads.huggingface.co/production/uploads/1592839207516-noauth.png?w=200&h=200&f=face',
                },
            },
            agent
        );

        const response2 = output2.Output;

        console.log(output2._error);
        expect(output2._error).toBeUndefined();
        expect(response2).toBeDefined();
    }, 90_000);
});
