import fs from 'fs';
import { describe, expect, it } from 'vitest';
import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import { SmythRuntime } from '@sre/index';

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
        Connector: 'JSONFileVault',
        Settings: {
            file: './tests/data/vault.json',
        },
    },
    Account: {
        Connector: 'SmythAccount',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
        },
    },
});

const TIMEOUT = 30000;

// TODO [Forhad]: Need to write more test cases

function runTestCases(endpoint: string) {
    const imageUrl1 = 'https://fastly.picsum.photos/id/478/536/354.jpg?hmac=adxYyHX8WcCfHkk07quT2s92fbC7vY2QttaeBztwxgI';

    const expectValidResponse = (result: any, minLength: number) => {
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThanOrEqual(minLength);
    };

    it(
        'should analyze a single image',
        async () => {
            const agentData = fs.readFileSync('./tests/data/test-llm.smyth', 'utf-8');
            const data = JSON.parse(agentData);
            const agentProcess = AgentProcess.load(data);

            const res = await agentProcess.run({
                method: 'POST',
                path: endpoint,
                body: {
                    Input: imageUrl1,
                },
            });

            const output = res?.data?.result?.Reply;
            expectValidResponse(output, 20);
        },
        TIMEOUT
    );
}

describe('VisionLLM', () => {
    runTestCases('/api/read-image-file-with-vision-llm');
});
