import FHash from '@sre/Components/FHash.class';
import FSleep from '@sre/Components/FSleep.class';
import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import config from '@sre/config';
import { Agent, AgentSettings, CLIAgentDataConnector, ConnectorService, SmythRuntime } from '@sre/index';
import { TConnectorService } from '@sre/types/SRE.types';
import fs from 'fs';
import crypto from 'crypto';

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

describe('FHash Component', () => {
    it('generate correct md5 hash', async () => {
        let error;
        try {
            const agentData = fs.readFileSync('./tests/data/functions-components.smyth', 'utf-8');
            const data = JSON.parse(agentData);
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
            const agentData = fs.readFileSync('./tests/data/functions-components.smyth', 'utf-8');
            const data = JSON.parse(agentData);
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
