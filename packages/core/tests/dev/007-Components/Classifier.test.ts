import { Agent } from '@sre/AgentManager/Agent.class';
import HuggingFace from '@sre/Components/HuggingFace.class';
import LLMAssistant from '@sre/Components/LLMAssistant.class';
import { config, SmythRuntime } from '@sre/index';
import { delay } from '@sre/utils/date-time.utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import util from 'util';
import path from 'path';
import Classifier from '@sre/Components/Classifier.class';

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
    const MockedAgent = vi.fn().mockImplementation(() => ({
        id: 'agent-123456',
        agentRuntime: { debug: true }, // used inside createComponentLogger()
    }));
    return { default: MockedAgent };
});

describe('Classifier Component', () => {
    it('should correctly classify an input using one of the options', async () => {
        // @ts-ignore
        const agent = new Agent();
        const input = `I'm upset`;
        const options = ['happy', 'sad', 'excited'];
        const answer = 'sad';
        const classifier = new Classifier();

        const output = await classifier.process(
            {
                Input: input,
            },
            {
                name: 'Classifier',
                data: {
                    model: 'gpt-4o',
                    prompt: `Classify the input content to one of the categories. Set the selected category to true and the others to empty value`,
                },
                outputs: options.map((option) => ({
                    name: option,
                    description: '',
                })),
            },
            agent,
        );

        expect(output).toBeDefined();
        // expect(output[answer]).toBe(true);

        for (let option of options) {
            if (option === answer) {
                expect(output[option]).toBe(true);
            } else {
                expect(output[option]).toBeFalsy();
            }
        }
    });
});
