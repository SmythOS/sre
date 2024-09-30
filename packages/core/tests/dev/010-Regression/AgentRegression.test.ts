import { afterAll, describe, expect, it, beforeAll } from 'vitest';
import express from 'express';

import config from '@sre/config';
import { AgentProcess, ConnectorService, Conversation, SmythRuntime } from '@sre/index';
import http, { Server } from 'http';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { promisify } from 'util';
import fs from 'fs/promises'; // for promise-based file reading
import fsSync from 'fs';

const PORT = 8083;
const BASE_URL = `http://localhost:${PORT}`;

const app = express();

const SREInstance = SmythRuntime.Instance.init({
    Account: {
        Connector: 'DummyAccount',
        Settings: {},
    },
    AgentData: {
        Connector: 'Local',
        Settings: {
            devDir: './tests/data/RegressionAgents',
            prodDir: './tests/data/RegressionAgents',
        },
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
    Router: {
        Connector: 'ExpressRouter',
        Settings: {
            router: app,
            baseUrl: BASE_URL,
        },
    },

    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './tests/data/vault.json',
        },
    },
});

const server = http.createServer(app);

if (!SREInstance.ready()) {
    process.exit(1);
} //force SmythRuntime to initialize

let agentFiles = fsSync.readdirSync('./tests/data/RegressionAgents');

describe('Agent Regression Tests', () => {
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

    it.each(agentFiles)('should run agent file %s', async (agentFile) => {
        const agentData = await fs.readFile(`./tests/data/RegressionAgents/${agentFile}`, 'utf-8');
        const data = JSON.parse(agentData);
        const agentId = data.id;
        const agentProcess = await AgentProcess.load(data);
        console.log();

        let systemPrompt = agentProcess.agent.data.behavior || agentProcess.agent.data.shortDescription;
        if (!systemPrompt) systemPrompt = agentProcess.agent.data.description; //data.description is deprecated, we just use it as a fallback for now

        const endpointPaths = agentProcess.agent.data.components.filter((c) => c.name === 'APIEndpoint').map((c) => c.data.endpoint);

        const evaluatorAgent = await fs.readFile('./tests/data/regression-tests-evalator.smyth', 'utf-8');
        const evaluatorAgentData = JSON.parse(evaluatorAgent);

        for (const path of endpointPaths) {
            //* get the Note components that hold the special names "test:input" and "test:output"

            const sampleInput = agentProcess.agent.data.components.find((c) => c.title === `${path}:input`).data.description;
            const expectedOutput = agentProcess.agent.data.components.find((c) => c.title === `${path}:output`).data.description;
            console.log(sampleInput, expectedOutput);
            if (!sampleInput) {
                console.log(`No sample input for ${path}`);
                continue;
            }
            if (!expectedOutput) {
                console.log(`No expected output for ${path}`);
                continue;
            }
            // const openapi = await ConnectorService.getAgentDataConnector().getOpenAPIJSON(agentData, 'http://localhost/', 'latest', true);
            const conv = new Conversation('gpt-4o-mini', agentId, { systemPrompt });

            const result = await conv.prompt(`call the endpoint ${path} with the following input: ${sampleInput}`, {
                'X-AGENT-ID': data.id,
            });

            const evaluatorResult = await AgentProcess.load(evaluatorAgentData).run({
                method: 'POST',
                path: '/api/test',
                body: {
                    data: result,
                    expectations: expectedOutput,
                },
            });

            expect(evaluatorResult?.data?.result?.valid).toEqual('true');
        }

        /*
       
        */
    });
});
