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
            bucket: config.env.AWS_S3_BUCKET_NAME || '',
            region: config.env.AWS_S3_REGION || '',
            accessKeyId: config.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: config.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
    AgentData: {
        Connector: 'Local',
        Settings: {
            devDir: './tests/data/AgentData',
            prodDir: './tests/data/AgentData',
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
    Vault: {
        Connector: 'SmythVault',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            vaultAPIBaseUrl: process.env.SMYTH_VAULT_API_BASE_URL,
        },
    },
});

ConnectorService.register(TConnectorService.AgentData, 'CLI', CLIAgentDataConnector);
ConnectorService.init(TConnectorService.AgentData, 'CLI');

// TODO [Forhad]: Need to implement more test cases for PromptGenerator
// - expect JSON output
// - expect error when model is not supported
// - run test cases for all providers
// - Need to separate test cases for custom models, as custom models require SmythAccount account connector

const TIMEOUT = 30000;

function runTestCases(endpoint: string) {
    it(
        'should generate a relevant response for a given prompt',
        async () => {
            let error;
            try {
                const agentData = fs.readFileSync('./tests/data/test-llm.smyth', 'utf-8');
                const data = JSON.parse(agentData);

                const agentProcess = AgentProcess.load(data);

                let res = await agentProcess.run({
                    method: 'POST',
                    path: endpoint,
                    body: {
                        Input: 'What is the largest planet in our solar system, and how does it compare to other planets in the Milky Way galaxy?',
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
        TIMEOUT * 2
    );
}

const llmProviderEndpoints = {
    OpenAI: '/api/test-openai-model',
    Bedrock: '/api/test-bedrock-model',
    VertexAI: '/api/test-vertexai-model',
};

for (const [provider, endpoint] of Object.entries(llmProviderEndpoints)) {
    describe(`PromptGenerator Component with - ${provider} (${endpoint})`, () => {
        runTestCases(endpoint);
    });
}
