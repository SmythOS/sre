import fs from 'fs';
import { describe, expect, it, vi } from 'vitest';

import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import { CLIAgentDataConnector, ConnectorService, SmythRuntime, AgentSettings } from '@sre/index';
import { TConnectorService } from '@sre/types/SRE.types';
import Agent from '@sre/AgentManager/Agent.class';
import AgentPlugin from '@sre/Components/AgentPlugin.class';

const sre = SmythRuntime.Instance.init({
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: process.env.AWS_S3_BUCKET_NAME || '',
            region: process.env.AWS_S3_REGION || '',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
    /* AgentData: {
        Connector: 'Local',
        Settings: {
            devDir: './tests/data/AgentData',
            prodDir: './tests/data/AgentData',
        },
    }, */
    AgentData: {
        Connector: 'Smyth',
        Settings: {
            agentStageDomain: process.env.AGENT_DOMAIN || '',
            agentProdDomain: process.env.PROD_AGENT_DOMAIN || '',
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
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
                path: '/api/test-agent-plugin',
            });

            const output = res?.data?.result?.Response;

            expect(output).toBeDefined();
            expect(output?.length).toBeGreaterThan(20);
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
            expect(output?.length).toBeGreaterThan(20);
            expect(output).toBeTypeOf('string');
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });

    it('test process function of AgentPlugin', async () => {
        const input = {
            Prompt: 'Which country is considered the middle of the world?',
        };
        const subAgentId = 'clp1tl4tx00129tq5owb0kfxh';
        const config = {
            id: '1',
            name: 'AgentPlugin',
            inputs: [
                {
                    name: 'Prompt',
                    type: 'Any',
                    color: '#F35063',
                    optional: false,
                    index: 0,
                    default: true,
                },
            ],
            data: {
                model: 'gpt-4o-mini',
                version: 'same-as-parent',
                descForModel:
                    'A dynamic agent that utilizes a POST API endpoint for interactions and generates prompts for effective communication with language models.',
                agentId: subAgentId,
                id: subAgentId,
                name: 'Sub Agent',
                desc: 'A dynamic agent that utilizes a POST API endpoint for interactions and generates prompts for effective communication with language models.',
            },
        };

        let error;

        try {
            const agentId = 'clp1tnwli001h9tq56c9m6i7j';
            const agentSettings = new AgentSettings(agentId);
            const agentData = fs.readFileSync('./tests/data/AgentData/parent-agent.smyth', 'utf-8');
            const data = JSON.parse(agentData);
            const agent = new Agent(agentId, { data }, agentSettings);

            const agentPlugin = new AgentPlugin();

            const result = await agentPlugin.process(input, config, agent);
            const output = result?.Response;

            // The sub-agent has an Endpoint and a LLM Prompt component that echo "Tell the user that the system is busy and that he should retry later"
            expect(output).toBeDefined();
            expect(output?.length).toBeGreaterThan(20);
            expect(output).toBeTypeOf('string');
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });
});
