import Agent from '@sre/AgentManager/Agent.class';
import HuggingFace from '@sre/Components/HuggingFace.class';
import LLMAssistant from '@sre/Components/LLMAssistant.class';
import { config, SmythRuntime } from '@sre/index';
import { delay } from '@sre/utils/date-time.utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import util from 'util';
import path from 'path';
import ZapierAction from '@sre/Components/ZapierAction.class';
import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { TConnectorService } from '@sre/types/SRE.types';

// Specific getter for Zapier API key
const apiKeyVaultKeyName = (): string => {
    // const apiKey = process.env.__TEST__ZAPIER_API_KEY;
    // if (!apiKey) {
    //     throw new Error('Zapier testing API Key is not set. Please set the __TEST__ZAPIER_API_KEY environment variable to run this test.');
    // }
    // // return apiKey;
    return `{{KEY(ZAPIER_API_KEY)}}`;
};

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
    const MockedAgent = vi.fn().mockImplementation(() => ({
        id: 'agent-123456',
        teamId: 'default',
        agentRuntime: { debug: true }, // used inside createComponentLogger()
    }));
    return { default: MockedAgent };
});

describe('ZapierAction Component', () => {
    beforeAll(async () => {
        // This will throw an error if the API key is not set
        const vaultConnector = ConnectorService.getVaultConnector();
        const agent = AccessCandidate.agent('agent-123456');

        const apiKey = await vaultConnector
            .user(agent)
            .get('ZAPIER_API_KEY')
            .catch((e) => {
                throw new Error('Failed to get Zapier API Key from vault. Please add ZAPIER_API_KEY to your vault.');
            });

        if (!apiKey) {
            throw new Error('Zapier testing API Key is not set. Please set the key in vault.json to run this test.');
        }
    });

    it('triggers a zapier action', async () => {
        // @ts-ignore
        const agent = new Agent();
        const zapierAction = new ZapierAction();

        //* the zapier code action code snippet: `output = [{isOk: true}];`

        const output = await zapierAction.process(
            {
                instructions: 'run code',
            },
            {
                data: {
                    actionId: '4d1de4b5-fde8-4cc4-8f2c-3b90ddc78e37',
                    actionName: 'ANY NAME',
                    // apiKey: '{{KEY(Zapier (3))}}',
                    apiKey: apiKeyVaultKeyName(),
                    logoUrl: 'https://app.smythos.dev/img/zapier.png',
                    params: '{"instructions":"str"}',
                },
            },
            agent
        );

        const response = output.Output;
        expect(output._error).toBeUndefined();
        expect(response).toBeDefined();

        expect(response?.result?.isOk).toBe(true);
    }, 60_000);
});
