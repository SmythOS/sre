import { FSleep } from '@sre/Components/FSleep.class';
import { Agent } from '@sre/AgentManager/Agent.class';
import { AgentSettings } from '@sre/AgentManager/AgentSettings.class';
import { describe, expect, it } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { loadAgentData } from '../../utils/test-data-manager';

setupSRE();

describe('FSleep Component', () => {
    it('agent should wait until sleep duration finishes', async () => {
        let error;
        try {
            const data = loadAgentData('AgentData/functions-components.smyth');
            const date = new Date();

            // const agentProcess = AgentProcess.load(data);

            // const
            // let output = await agentProcess.run({
            //     method: 'POST',
            //     path: '/api/sleep_10',
            //     body: {},
            // });

            // let outputResult = output?.result;

            const agent = new Agent(10, data, new AgentSettings(10));

            const fSleepComponent = new FSleep();
            const start = process.hrtime();
            const output = await fSleepComponent.process({}, { name: 'sleep', data: { delay: 3 } }, agent);
            const end = process.hrtime(start);
            const durationSec = end[0] + end[1] / 1e9;

            expect(durationSec).toBeGreaterThanOrEqual(3);

            console.log(output);

            // agent should wait for 10 seconds
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });
});
