import FEncDec from '@sre/Components/FEncDec.class';
import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import config from '@sre/config';
import { Agent, AgentSettings, CLIAgentDataConnector, ConnectorService, SmythRuntime } from '@sre/index';
import { TConnectorService } from '@sre/types/SRE.types';
import fs from 'fs';

import { describe, expect, it } from 'vitest';
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
});

ConnectorService.register(TConnectorService.AgentData, 'CLI', CLIAgentDataConnector);
ConnectorService.init(TConnectorService.AgentData, 'CLI');

describe('FEncDec Component', () => {
    it('encodes data', async () => {
        let error;
        try {
            const agentData = fs.readFileSync('./tests/data/functions-components.smyth', 'utf-8');
            const data = JSON.parse(agentData);
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
            const agentData = fs.readFileSync('./tests/data/functions-components.smyth', 'utf-8');
            const data = JSON.parse(agentData);
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
