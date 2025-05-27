import { describe, expect, it } from 'vitest';
import config from '@sre/config';
import { SmythRuntime } from '@sre/index';
import { Conversation } from '@sre/helpers/Conversation.helper';
import * as path from 'path';

const TEST_DATA_PATH = process.env.DATA_DIR;
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
        Connector: 'Smyth',
        Settings: {
            agentStageDomain: process.env.AGENT_DOMAIN || '',
            agentProdDomain: process.env.PROD_AGENT_DOMAIN || '',
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
        },
    },

    Account: {
        Connector: 'JSONFileAccount',
        Settings: {
            file: path.join(TEST_DATA_PATH, 'account.json'),
        },
    },
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: path.join(TEST_DATA_PATH, 'vault.json'),
        },
    },

    /*
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
    */
});

const TIMEOUT = 30000;
const LLM_OUTPUT_VALIDATOR = 'Yohohohooooo!';
const WORD_INCLUSION_PROMPT = `\nThe response must includes "${LLM_OUTPUT_VALIDATOR}".`;

const AGENT_ID = 'clv0s83pw078qa80uv5zjy3cc';

function runTestCases(model: string) {
    it(
        'runs a conversation with tool use',
        async () => {
            const system =
                `You are a helpful assistant that can use available endpoints to give proper responses based on the user's request.` +
                WORD_INCLUSION_PROMPT;

            const conv = new Conversation(model, AGENT_ID, { systemPrompt: system });

            const prompt = 'What can you help me with?';

            const result = await conv.prompt(prompt);

            expect(result).toBeTruthy();
            expect(result).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT,
    );

    it(
        'runs a conversation with tool use in stream mode',
        async () => {
            const system =
                `You are a helpful assistant that can use available endpoints to give proper responses based on the user's request.` +
                WORD_INCLUSION_PROMPT;
            const conv = new Conversation(model, AGENT_ID, { systemPrompt: system });

            let streamResult = '';

            // * The order is important to ensure proper event handling:
            // 1. Set up event listeners before calling streamPrompt to capture all events. ie. const streamComplete = new Promise<string>((resolve) => {...
            // 2. Call streamPrompt to initiate the streaming process. ie. const result = await conv.streamPrompt(...);
            // 3. Wait for the stream to complete to ensure all content is received. ie. await streamComplete;
            const streamComplete = new Promise<string>((resolve) => {
                conv.on('content', (content) => {
                    streamResult += content;
                });
                conv.on('end', resolve);
            });

            const prompt = 'What can you help me with?';

            const result = await conv.streamPrompt(prompt);

            await streamComplete;

            expect(result).toBeTruthy();
            expect(streamResult).toBeTruthy();
            expect(streamResult).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT * 2,
    );

    it(
        'handles multiple tool calls in a single conversation',
        async () => {
            const system =
                `You are a helpful assistant that can use available endpoints to give proper responses based on the user's request.` +
                WORD_INCLUSION_PROMPT;
            const conv = new Conversation(model, AGENT_ID, { systemPrompt: system });

            let streamResult = '';

            // * The order is important to ensure proper event handling:
            // 1. Set up event listeners before calling streamPrompt to capture all events. ie. const streamComplete = new Promise<string>((resolve) => {...
            // 2. Call streamPrompt to initiate the streaming process. ie. const result = await conv.streamPrompt(...);
            // 3. Wait for the stream to complete to ensure all content is received. ie. await streamComplete;
            const streamComplete = new Promise<string>((resolve) => {
                conv.on('content', (content) => {
                    streamResult += content;
                });
                conv.on('end', resolve);
            });

            const prompt = 'First Publish post with title "Impact of AI in Software development", and get 2 recent posts';

            const result = await conv.streamPrompt(prompt);

            await streamComplete;

            expect(result).toBeTruthy();
            expect(streamResult).toBeTruthy();
            expect(streamResult).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT * 3,
    );

    it(
        'handles follow-up questions correctly',
        async () => {
            const conv = new Conversation(model, AGENT_ID);

            const prompt = 'Publish post with title "Impact of AI in Software development?' + WORD_INCLUSION_PROMPT;

            await conv.prompt(prompt);

            const followUpPrompt = 'Give me the published post details with one more latest post?' + WORD_INCLUSION_PROMPT;
            const followUpResult = await conv.prompt(followUpPrompt);

            expect(followUpResult).toBeTruthy();
            expect(followUpResult).toContain(LLM_OUTPUT_VALIDATOR);
        },
        TIMEOUT * 5,
    );
}

const models = [{ provider: 'Bedrock', id: 'SRE - Bedrock for Tool Use' }];

for (const model of models) {
    describe(`Conversation Tests with Custom LLM: ${model.provider} (${model.id})`, async () => {
        await runTestCases(model.id);
    });
}
