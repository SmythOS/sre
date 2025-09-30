import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import config from '@sre/config';
import { CLIAgentDataConnector, ConnectorService, SmythRuntime } from '@sre/index';
import { TConnectorService } from '@sre/types/SRE.types';
import fs from 'fs';

import { describe, expect, it } from 'vitest';
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
        Connector: 'SecretsManager',
        Settings: {
            region: process.env.AWS_REGION,
        },
    },
    Account: {
        Connector: 'DummyAccount',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
        },
    },
    Log: {
        Connector: 'ConsoleLog',
    },
});

ConnectorService.register(TConnectorService.AgentData, 'CLI', CLIAgentDataConnector);
ConnectorService.init(TConnectorService.AgentData, 'CLI');
describe('ServerlessCode Component', () => {
    it('ServerlessCode : Run lambda Code and return output', async () => {
        let error;
        try {
            const agentData = fs.readFileSync('./tests/data/serverless-code-sample.smyth', 'utf-8');
            const data = JSON.parse(agentData);
            const date = new Date();

            const agentProcess = AgentProcess.load(data);

            let output = await agentProcess.run({
                method: 'POST',
                path: '/api/test',
                body: {
                    name: 'test',
                    description: 'test',
                },
            });

            console.log('>>>>>>', output?.data?.result);
            expect(output?.data?.result?.Output).toBeDefined();
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });

});
