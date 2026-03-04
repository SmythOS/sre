import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import config from '@sre/config';
import { CLIAgentDataConnector, ConnectorService, SmythRuntime } from 'index';
import { TConnectorService } from '@sre/types/SRE.types';
import fs from 'fs';

import { describe, expect, it } from 'vitest';
import { loadAgentData } from '../../utils/test-data-manager';

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

describe('GPTPlugin Component', () => {
    it('runs a simple OpenAPI Plugin request', async () => {
        let error;
        try {
            const data = loadAgentData('AgentData/sre-llm.smyth');

            const agentProcess = AgentProcess.load(data);

            let res = await agentProcess.run({
                method: 'POST',
                path: '/api/test-gpt-plugin',
                body: {
                    Input: 'Monitors',
                },
            });

            const output = res?.data?.result?.Output;

            expect(output).toBeDefined();
            expect(output).toBeTypeOf('string');
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });

    it('should handle missing prompt', async () => {
        let error;
        try {
            const data = loadAgentData('AgentData/sre-llm.smyth');
            const agentProcess = AgentProcess.load(data);

            let output = await agentProcess.run({
                method: 'POST',
                path: '/api/test-gpt-plugin',
                body: {
                    Input: '',
                },
            });

            expect(output?.data?.result?._error).toBe('Please provide a prompt');
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });

    it('should use template string for descForModel', async () => {
        let error;
        try {
            const data = loadAgentData('AgentData/sre-llm.smyth');
            data.components[0].data.descForModel = 'Description for {{Query}}';

            const agentProcess = AgentProcess.load(data);

            let output = await agentProcess.run({
                method: 'POST',
                path: '/api/test-gpt-plugin',
                body: {
                    Input: 'Monitors',
                },
            });

            expect(output?.data?.result?.Output).toBeDefined();
            expect(output?.data?.result?.Output).toBeTypeOf('string');
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });

    it('should handle different input types', async () => {
        let error;
        try {
            const data = loadAgentData('AgentData/sre-llm.smyth');

            const agentProcess = AgentProcess.load(data);

            const testCases = [
                { Input: 'LED Monitors' },
                { Input: JSON.stringify({ complex: 'Monitors', with: ['Energy Saving', 'Eye protector'] }) },
                { Input: 42 },
                { Input: true },
            ];

            for (let testCase of testCases) {
                let output = await agentProcess.run({
                    method: 'POST',
                    path: '/api/test-gpt-plugin',
                    body: testCase,
                });
                agentProcess.reset();

                expect(output?.data?.result?.Output).toBeDefined();
                expect(output?.data?.result?.Output).toBeTypeOf('string');
            }
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });

    // TODO [Forhad]: Need to add test case for large input after implementing the token limit check
});
