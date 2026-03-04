import Agent from '@sre/AgentManager/Agent.class';
import HuggingFace from '@sre/Components/HuggingFace.class';
import LLMAssistant from '@sre/Components/LLMAssistant.class';
import { config, SmythRuntime } from '@sre/index';
import { delay } from '@sre/utils/date-time.utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import util from 'util';
import path from 'path';
import Classifier from '@sre/Components/Classifier.class';
import ImageGenerator from '@sre/Components/ImageGenerator.class';
import { GenerateImageConfig } from '@sre/types/LLM.types';

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

// Mock Agent class to keep the test isolated from the actual Agent implementation
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => ({
        id: 'agent-123456',
        agentRuntime: { debug: true }, // used inside createComponentLogger()
    }));
    return { default: MockedAgent };
});

const TIMEOUT = 30000;

describe('ImageGenerator Component', () => {
    it('should generate an image and return the URL', async () => {
        const imageGenerator = new ImageGenerator();
        const configData: GenerateImageConfig & { responseFormat: 'url' | 'b64_json'; prompt: string } = {
            model: 'dall-e-3',
            responseFormat: 'url',
            prompt: 'A beautiful landscape with a river and mountains',
        };

        // @ts-ignore
        const agent = new Agent();
        const result = await imageGenerator.process({}, { data: configData }, agent);

        expect(result._error).toBeUndefined();
        expect(result.Output).toBeDefined();
        // match any valid URL.
        expect(result.Output).toMatch(/^https:\/\/[^ ]+$/);
    }, TIMEOUT);

    it('should generate an image and return the base64', async () => {
        const imageGenerator = new ImageGenerator();
        const configData = {
            model: 'dall-e-3',
            responseFormat: 'b64_json',
            prompt: 'A beautiful landscape with a river and mountains',
        };

        // @ts-ignore
        const agent = new Agent();
        const result = await imageGenerator.process({}, { data: configData }, agent);

        expect(result._error).toBeUndefined();
        expect(result.Output).toBeDefined();
        expect(result.Output).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
        //* it is a base64 image but not base64 URL
    }, TIMEOUT);

    it('should throw an error when no prompt is given', async () => {
        const imageGenerator = new ImageGenerator();
        const configData: GenerateImageConfig & { responseFormat: 'url' | 'b64_json'; prompt: string } = {
            model: 'dall-e-3',
            responseFormat: 'url',
            prompt: '',
        };

        // @ts-ignore
        const agent = new Agent();

        const result = await imageGenerator.process({}, { data: configData }, agent);

        expect(result._error).toBeDefined();
    }, TIMEOUT);
});
