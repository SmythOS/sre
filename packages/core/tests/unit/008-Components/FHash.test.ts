import { FHash } from '@sre/Components/FHash.class';
import { Agent } from '@sre/AgentManager/Agent.class';
import { AgentSettings } from '@sre/AgentManager/AgentSettings.class';
import { loadAgentData } from '../../utils/test-data-manager';
import { setupSRE } from '../../utils/sre';
import crypto from 'crypto';

import { describe, expect, it } from 'vitest';

setupSRE();

describe('FHash Component', () => {
    it('generate correct md5 hash', async () => {
        let error;
        try {
            const data = loadAgentData('AgentData/functions-components.smyth');
            const date = new Date();

            const agent = new Agent(10, data, new AgentSettings(10));

            const fHash = new FHash();
            const dataToHash = 'Hello World';
            const output = await fHash.process({ Data: dataToHash }, { data: { algorithm: 'md5', encoding: 'hex' } }, agent);
            const expectedHash = crypto.createHash('md5').update(dataToHash).digest('hex');
            expect(output.Hash).toBe(expectedHash);

            console.log(output);

            // agent should wait for 10 seconds
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });

    it('generate correct sha256 hash', async () => {
        let error;
        try {
            const data = loadAgentData('AgentData/functions-components.smyth');
            const date = new Date();

            const agent = new Agent(10, data, new AgentSettings(10));

            const fHash = new FHash();
            const dataToHash = 'Hello World';
            const output = await fHash.process({ Data: dataToHash }, { data: { algorithm: 'sha256', encoding: 'hex' } }, agent);
            const expectedHash = crypto.createHash('sha256').update(dataToHash).digest('hex');
            expect(output.Hash).toBe(expectedHash);

            console.log(output);

            // agent should wait for 10 seconds
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });
});
