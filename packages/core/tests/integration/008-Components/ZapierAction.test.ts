import Agent from '@sre/AgentManager/Agent.class';
import HuggingFace from '@sre/Components/HuggingFace.class';
import LLMAssistant from '@sre/Components/LLMAssistant.class';
import { config, SmythRuntime } from '@sre/index';
import { delay } from '@sre/utils/date-time.utils';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import util from 'util';
import path from 'path';
import ZapierAction from '@sre/Components/ZapierAction.class';
import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { TConnectorService } from '@sre/types/SRE.types';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import axios from 'axios';
import http from 'http';
import { promisify } from 'util';
import express, { Router } from 'express';

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

const PORT = 8084;
const BASE_URL = `http://localhost:${PORT}`;
const app = express();

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

    Account: {
        Connector: 'DummyAccount',
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

    Router: {
        Connector: 'ExpressRouter',
        Settings: {
            router: app,
            baseUrl: BASE_URL,
        },
    },
});

const server = http.createServer(app);

const ZAPIER_DEFAULT_ACTION_ID = 'bef9dc04-e6f9-482a-9c45-513375182818';

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

        console.log('apiKey', apiKey);

        if (!apiKey) {
            throw new Error('Zapier testing API Key is not set. Please set the key in vault.json to run this test.');
        }
    });

    beforeAll(async () => {
        const listen = promisify(server.listen.bind(server));
        await listen(PORT);
        console.log(`Server is running on port ${PORT}`);
    });

    afterAll(async () => {
        const close = promisify(server.close.bind(server));
        await close();
        console.log('Server has been shut down');
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
                    actionId: ZAPIER_DEFAULT_ACTION_ID,
                    actionName: 'ANY NAME',
                    // apiKey: '{{KEY(Zapier (3))}}',
                    apiKey: apiKeyVaultKeyName(),
                    logoUrl: 'https://app.smythos.dev/img/zapier.png',
                    params: '{"instructions":"run 1+1"}',
                },
            },
            agent
        );

        const response = output.Output;
        expect(output._error).toBeUndefined();
        expect(response).toBeDefined();

        expect(response?.result?.isOk).toBe(true);
    }, 60_000);

    it('should pass a temp pub url of smyth file input to the action', async () => {
        //@ts-ignore
        const agent = new Agent();
        const zapierAction = new ZapierAction();
        const img = await fs.promises.readFile(path.join(__dirname, '../../data/avatar.png'));
        const obj = await BinaryInput.from(img).getJsonData(AccessCandidate.agent(agent.id));

        //* the zapier code action code snippet: `output = [{isOk: true}];`

        // mock axios.post to see the passed inputs
        const spy = vi.spyOn(axios, 'post').mockResolvedValueOnce({ data: { result: { isOk: true } } });

        const output = await zapierAction.process(
            {
                instructions: 'run code',
                img: obj,
            },
            {
                data: {
                    actionId: ZAPIER_DEFAULT_ACTION_ID,
                    actionName: 'ANY NAME',
                    // apiKey: '{{KEY(Zapier (3))}}',
                    apiKey: apiKeyVaultKeyName(),
                    logoUrl: 'https://app.smythos.dev/img/zapier.png',
                    params: '{"instructions":"str", "img": "{{FILE(img)}}"}',
                },
            },
            agent
        );

        //get the first argument of the first call to axios.post
        const firstCallArguments = spy.mock.calls[0];
        // const url = (firstCallArguments[1] as any)?.img as Awaited<ReturnType<typeof BinaryInput.prototype.getJsonData>>;
        const url = (firstCallArguments[1] as any)?.img as string;
        expect(url).toBeDefined();
        expect(url.startsWith(`${BASE_URL}/_temp/`)).toBe(true);

        // expect the pub url access to be deleted after the the agent finishes processing
        // wait for 5 seconds because the temp url deletion run in the background
        await delay(5000);
        const responseErr = await axios.get(url).catch((e) => e);
        expect(responseErr?.response?.status || responseErr?.status, 'temp url should not be accessible after agent processing finished').toBe(404);
    });
});
