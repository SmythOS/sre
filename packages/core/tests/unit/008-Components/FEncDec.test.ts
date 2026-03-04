import { FEncDec } from '@sre/Components/FEncDec.class';
import { Agent } from '@sre/AgentManager/Agent.class';
import { AgentSettings } from '@sre/AgentManager/AgentSettings.class';
import { describe, expect, it } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { loadAgentData } from '../../utils/test-data-manager';

setupSRE();

describe('FEncDec Component', () => {
    it('encodes data', async () => {
        let error;
        try {
            const data = loadAgentData('AgentData/functions-components.smyth');
            const date = new Date();

            const agent = new Agent(10, data, new AgentSettings(10));

            const fEncDec = new FEncDec();
            const decodedData = 'Hello World';
            const encodeOutput = await fEncDec.process({ Data: decodedData }, { data: { action: 'Encode', encoding: 'hex' } }, agent);
            expect(encodeOutput.Output).toBe(Buffer.from(decodedData).toString('hex'));
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });

    it('decodes data', async () => {
        let error;
        try {
            const data = loadAgentData('AgentData/functions-components.smyth');
            const date = new Date();

            const agent = new Agent(10, data, new AgentSettings(10));

            const fEncDec = new FEncDec();
            const encodedData = Buffer.from('Hello World').toString('hex');
            const decodeOutput = await fEncDec.process({ Data: encodedData }, { data: { action: 'Decode', encoding: 'hex' } }, agent);
            expect(decodeOutput.Output).toBe(Buffer.from(encodedData, 'hex').toString('utf8'));
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });
});
