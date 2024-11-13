import fs from 'fs';
import { describe, expect, it, vi, beforeEach } from 'vitest';

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
});

const TIMEOUT = 30000;

// TODO [Forhad]: Need to write more test cases

function runTestCases(endpoint: string) {
    const videoUrl = 'https://storage.googleapis.com/generativeai-downloads/images/GreatRedSpot.mp4';

    it(
        'should generate a relevant response for a given prompt with attached file',
        async () => {
            let error;
            try {
                const agentData = fs.readFileSync('./tests/data/sre-llm.smyth', 'utf-8');
                const data = JSON.parse(agentData);

                const agentProcess = AgentProcess.load(data);

                let res = await agentProcess.run({
                    method: 'POST',
                    path: endpoint,
                    body: {
                        Input: videoUrl,
                    },
                });

                const output = res?.data?.result?.Reply;

                expect(output).toBeTruthy();
            } catch (e) {
                error = e;
                console.error(e.message);
            }
            expect(error).toBeUndefined();
        },
        TIMEOUT * 20 // 10 mins
    );
}

describe('MultimodalLLM', () => {
    runTestCases('/api/read-video-file-with-multimodal-llm');
});
