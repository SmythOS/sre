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

// Preload and prepare all data
type PreparedAgentData = {
    agentFile: string;
    agentProcess: AgentProcess;
    systemPrompt: string;
    endpointPaths: string[];
};

const prepareAgentData = async (agentFile: string): Promise<PreparedAgentData> => {
    try {
        console.log(`Loading agent file: ${agentFile}`);
        const agentData = await fs.readFile(`./tests/data/RegressionAgents/${agentFile}`, 'utf-8');
        const data = JSON.parse(agentData);
        const agentProcess = await AgentProcess.load(data);

        if (!agentProcess || !agentProcess.agent || !agentProcess.agent.data) {
            throw new Error('Invalid agent data structure');
        }

        const systemPrompt = agentProcess.agent.data.behavior || agentProcess.agent.data.shortDescription || agentProcess.agent.data.description;

        if (!Array.isArray(agentProcess.agent.data.components)) {
            throw new Error('AgentProcess.agent.data.components is not an array');
        }

        const endpointPaths = agentProcess.agent.data.components
            .filter((c) => c && c.name === 'APIEndpoint')
            .map((c) => c.data && c.data.endpoint)
            .filter(Boolean);

        console.log(`Endpoint paths for ${agentFile}:`, endpointPaths);

        return { agentFile, agentProcess, systemPrompt, endpointPaths };
    } catch (error) {
        console.error(`Error loading agent ${agentFile}:`, error);
        throw error;
    }
};

let preparedAgents: PreparedAgentData[];
preparedAgents = await Promise.all(agentFiles.map(prepareAgentData)); // Preload all agent data

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

    describe.each(preparedAgents)('Agent File: $agentFile', ({ agentFile, agentProcess, systemPrompt, endpointPaths }) => {
        it('should have valid endpoint paths', () => {
            expect(Array.isArray(endpointPaths)).toBe(true);
            expect(endpointPaths.length).toBeGreaterThan(0);
        });

        it.each(endpointPaths)('should correctly handle endpoint: %s', async (path) => {
            const sampleInput = agentProcess.agent.data.components.find((c) => c.title === `${path}:input`)?.data?.description;
            const expectedOutput = agentProcess.agent.data.components.find((c) => c.title === `${path}:output`)?.data?.description;

            if (!sampleInput || !expectedOutput) {
                console.log(`Skipping test for ${path} due to missing input or output`);
                return;
            }

            const conv = new Conversation('gpt-4o-mini', agentProcess.agent.data.id, { systemPrompt });

            const result = await conv.prompt(`call the endpoint ${path} with the following input: ${sampleInput}.`, {
                'X-AGENT-ID': agentProcess.agent.data.id,
            });

            const evaluatorAgent = await fs.readFile('./tests/data/regression-tests-evalator.smyth', 'utf-8');
            const evaluatorAgentData = JSON.parse(evaluatorAgent);

            console.log(`Recieved: ${JSON.stringify(result)}. \n Expected: ${expectedOutput}`);

            const evaluatorResult = await AgentProcess.load(evaluatorAgentData).run({
                method: 'POST',
                path: '/api/test',
                body: {
                    data: JSON.stringify(result),
                    expectations: expectedOutput,
                },
            });

            expect(evaluatorResult?.data?.result?.valid, `Evaluator result for ${path} is not valid`).toEqual('true');
        });
    });
});
