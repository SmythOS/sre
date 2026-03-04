import fs from 'fs';
import { describe, expect, it } from 'vitest';

import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import config from '@sre/config';
import { CLIAgentDataConnector, ConnectorService, SmythRuntime } from '@sre/index';
import { TConnectorService } from '@sre/types/SRE.types';

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
// - provide some outputs params and check if it's response with those params properly

const TIMEOUT = 30000;
const LLM_OUTPUT_VALIDATOR = 'Yohohohooooo!';
const WORD_INCLUSION_PROMPT = `\nThe response must includes "${LLM_OUTPUT_VALIDATOR}". If the response is JSON, then include an additional key-value pair with key as "${LLM_OUTPUT_VALIDATOR}" and value as "${LLM_OUTPUT_VALIDATOR}"`;

describe('PromptGenerator Component - Echo', () => {
    it('should echo the prompt', async () => {
        const agentData = fs.readFileSync('./tests/data/sre-llm.smyth', 'utf-8');
        const data = JSON.parse(agentData);

        const agentProcess = AgentProcess.load(data);

        const obj = { a: 1, b: 2, c: [1, 2] };

        let res = await agentProcess.run({
            method: 'POST',
            path: '/api/test-echo',
            body: {
                Input: JSON.stringify(obj),
            },
        });

        const output = res?.data?.result?.Reply;

        expect(output).toEqual(obj);
    });
});

function runTestCasesWithAgent(endpoint: string) {
    it(
        'should generate a relevant response for a given prompt',
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
                        Input:
                            'What is the largest planet in our solar system, and how does it compare to other planets in the Milky Way galaxy?' +
                            WORD_INCLUSION_PROMPT,
                    },
                });

                const output = res?.data?.result?.Reply;

                expect(output).toBeTruthy();
                expect(output).toBeTypeOf('object');
                expect(JSON.stringify(output)).toContain(LLM_OUTPUT_VALIDATOR);
            } catch (e) {
                error = e;
                console.error(e.message);
            }
            expect(error).toBeUndefined();
        },
        TIMEOUT * 2
    );
}

const llmProviderEndpoints = [
    { provider: 'OpenAI', endpoint: '/api/test-openai-model' },
    { provider: 'Anthropic', endpoint: '/api/test-anthropic-model' },
    { provider: 'GoogleAI', endpoint: '/api/test-googleai-model' },
    { provider: 'Groq', endpoint: '/api/test-groq-model' },
    { provider: 'TogetherAI', endpoint: '/api/test-togetherai-model' },
    { provider: 'Bedrock', endpoint: '/api/test-bedrock-model' },
    { provider: 'Bedrock', endpoint: '/api/test-bedrock-model-that-does-not-support-system' },
    { provider: 'VertexAI', endpoint: '/api/test-vertexai-model' },
];

for (const endpoint of llmProviderEndpoints) {
    describe(`PromptGenerator Component - ${endpoint.provider} (${endpoint.endpoint})`, () => {
        runTestCasesWithAgent(endpoint.endpoint);
    });
}
