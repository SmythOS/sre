import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import { describe, expect, it } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { loadAgentData } from '../../utils/test-data-manager';

setupSRE();

describe('ForEach Component', () => {
    it('should process input array', async () => {
        const data = loadAgentData('AgentData/async-await-foreach-tests.smyth');
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
