import { describe, expect, it } from 'vitest';
import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import { Agent } from '@sre/AgentManager/Agent.class';
import { AgentSettings } from '@sre/AgentManager/AgentSettings.class';
import { AgentPlugin } from '@sre/Components/AgentPlugin.class';
import { setupSRE } from '../../utils/sre';
import { loadAgentData } from '../../utils/test-data-manager';

setupSRE();

// TODO [Forhad]: Need to add more test cases for AgentPlugin

describe('AgentPlugin Component', () => {
    it('runs a simple Agent Plugin with GET request', async () => {
        let error;
        try {
            const data = loadAgentData('AgentData/sre-llm.smyth');

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
            const data = loadAgentData('AgentData/sre-llm.smyth');

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
            const data = loadAgentData('AgentData/parent-agent.smyth');
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
