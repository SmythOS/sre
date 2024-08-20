import ForEach from '@sre/Components/ForEach.class';
import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import config from '@sre/config';
import { Agent, AgentSettings, CLIAgentDataConnector, ConnectorService, SmythRuntime } from '@sre/index';
import { TConnectorService } from '@sre/types/SRE.types';
import fs from 'fs';
import { describe, expect, it } from 'vitest';

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

ConnectorService.register(TConnectorService.AgentData, 'CLI', CLIAgentDataConnector);
ConnectorService.init(TConnectorService.AgentData, 'CLI');

describe('ForEach Component', () => {
    it('should process input array', async () => {
        const agentData = fs.readFileSync('./tests/data/async-await-foreach-tests.smyth', 'utf-8');
        const data = JSON.parse(agentData);
        const date = new Date();

        const agentProcess = AgentProcess.load(data);

        let output = await agentProcess.run({
            method: 'POST',
            path: '/api/for-each-job',
            body: {
                prompts: ['Hello', 'World', 'Foo', 'Bar'],
            },
        });

        const results = output.data?.result?.Output?.results;

        expect(results).toHaveLength(4);

        expect(results).toEqual(['Hello', 'World', 'Foo', 'Bar']);
    });
});
