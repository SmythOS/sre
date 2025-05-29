import { FSleep } from '@sre/Components/FSleep.class';
import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import config from '@sre/config';
import { Agent } from '@sre/AgentManager/Agent.class';
import { AgentSettings } from '@sre/AgentManager/AgentSettings.class';
import { CLIAgentDataConnector } from '@sre/AgentManager/AgentData.service/connectors/CLIAgentDataConnector.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
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

describe('FSleep Component', () => {
    it('agent should wait until sleep duration finishes', async () => {
        let error;
        try {
            const agentData = fs.readFileSync('./tests/data/functions-components.smyth', 'utf-8');
            const data = JSON.parse(agentData);
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
