import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import config from '@sre/config';
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

describe('FTimestamp Component', () => {
    it('generates timestamp', async () => {
        let error;
        try {
            const agentData = fs.readFileSync('./tests/data/functions-components.smyth', 'utf-8');
            const data = JSON.parse(agentData);
            const date = new Date();

            const agentProcess = AgentProcess.load(data);

            let output = await agentProcess.run({
                method: 'POST',
                path: '/api/timestamp',
                body: {},
            });

            let outputResult = output?.data?.result;
            expect(outputResult).toBeDefined();

            expect(outputResult?.Timestamp).toBeDefined();
            expect(outputResult?.Timestamp).toBeGreaterThan(date.getTime()); // Timestamp should be greater than current time

            expect(outputResult?._error).toBeUndefined();
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });
});
