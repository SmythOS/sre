import { describe, expect, it, vi } from 'vitest';

import { SmythRuntime } from '@sre/index';
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
        id: 'clp1tnwli001h9tq56c9m6i7j',
        agentRuntime: { debug: true }, // used inside createComponentLogger()
        teamId: 'cloilcrl9001v9tkguilsu8dx',
    }));
    return { default: MockedAgent };
});

// @ts-ignore (Ignore required arguments, as we are using the mocked Agent)
const agent = new Agent();
const agentPlugin = new AgentPlugin();

// * NOTE: When try to test the process function and the AgentPlugin component class in a same file we have some conflicts.
// * So, we have to test the process function in a separate file.

describe('AgentPlugin Component - process function', () => {
    it('test process function of AgentPlugin', async () => {
        const input = {
            Prompt: 'Hello',
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
            const result = await agentPlugin.process(input, config, agent);
            const output = result?.Response;

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
