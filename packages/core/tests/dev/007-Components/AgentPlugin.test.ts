import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import config from '@sre/config';
import { CLIAgentDataConnector, ConnectorService, SmythRuntime } from '@sre/index';
import { TConnectorService } from '@sre/types/SRE.types';
import fs from 'fs';

import { describe, expect, it } from 'vitest';

const sre = SmythRuntime.Instance.init({
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: config.env.AWS_S3_BUCKET_NAME || '',
            region: config.env.AWS_S3_REGION || '',
            accessKeyId: config.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: config.env.AWS_SECRET_ACCESS_KEY || '',
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

// TODO [Forhad]: Need to add more test cases for AgentPlugin

describe('AgentPlugin Component', () => {
    it('runs a simple Agent Plugin with GET request', async () => {
        let error;
        try {
            const agentData = fs.readFileSync('./tests/data/sre-llm.smyth', 'utf-8');
            const data = JSON.parse(agentData);

            const agentProcess = AgentProcess.load(data);

            let res = await agentProcess.run({
                method: 'GET',
                path: '/api/test-agent-plugin'
            });

            const output = res?.data?.result?.Response;

            expect(output).toBeDefined();
            expect(output).toBeTypeOf('string');
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });

    it('runs a simple Agent Plugin with POST request', async () => {
        let error;
        try {
            const agentData = fs.readFileSync('./tests/data/sre-llm.smyth', 'utf-8');
            const data = JSON.parse(agentData);

            const agentProcess = AgentProcess.load(data);

            let res = await agentProcess.run({
                method: 'POST',
                path: '/api/test-agent-plugin',
                body: {
                    title: 'SmythOS - Design AI Agents with Drag & Drop Ease',
                    body: 'Seamlessly integrate AI, APIs, and data sources through our no-code platform. Just drag and drop. Simplify complexity, enhance control, and accelerate innovation — all in an afternoon.',
                    userId: 1,
                },
            });

            const output = res?.data?.result?.Response;

            expect(output).toBeDefined();
            expect(output).toBeTypeOf('string');
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });
});
