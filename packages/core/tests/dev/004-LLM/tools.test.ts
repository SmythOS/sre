import { describe, expect, it, beforeEach } from 'vitest';

import config from '@sre/config';
import { SmythRuntime } from '@sre/index';
import { Conversation } from '@sre/helpers/Conversation.helper';
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
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './tests/data/vault.json',
        },
    },
});

function runTestCases(model: string) {
    it(`runs a conversation with tool use with Model: ${model}`, async () => {
        const specUrl = 'https://clp1tl4tx00129tq5owb0kfxh.agent.stage.smyth.ai/api-docs/openapi.json';
        const system = `You are a helpful assistant that can answer questions about SmythOS.
if the user asks any question, use /ask endpoint to get information and be able to answer it.`;

        const conv = new Conversation(model, specUrl);
        conv.systemPrompt = system;
        conv.on('beforeToolCall', (args) => {
            console.log('beforeToolCall', args);
        });
        const result = await conv.prompt('What can you help me with ?');

        expect(result).toBeDefined();
    }, 30000);

    it(`runs a conversation with tool use in stream mode with Model: ${model}`, async () => {
        const specUrl = 'https://clp1tl4tx00129tq5owb0kfxh.agent.stage.smyth.ai/api-docs/openapi.json';
        const system = `You are a helpful assistant that can answer questions about SmythOS.
if the user asks any question, use /ask endpoint to get information and be able to answer it.`;

        const conv = new Conversation(model, specUrl);
        conv.systemPrompt = system;

        let streamResult = '';
        conv.on('beforeToolCall', (args) => {
            //console.log('beforeToolCall', args);
        });
        conv.on('content', (content) => {
            //console.log('data', content);
            streamResult += content;
        });
        const result = await conv.streamPrompt('What can you help me with ?');

        expect(result).toBeDefined();
    }, 30000);

    it(`runs a conversation with remote sentinel agent with Model: ${model}`, async () => {
        const specUrl = 'https://closz0vak00009tsctm7e8xzs.agent.stage.smyth.ai/api-docs/openapi.json';

        const conv = new Conversation(model, specUrl);

        let streamResult = '';
        conv.on('beforeToolCall', (args) => {
            //console.log('beforeToolCall', args);
        });
        conv.on('content', (content) => {
            //console.log('data', content);
            streamResult += content;
        });
        conv.on('afterToolCall', (toolArgs, functionResponse) => {
            console.log('afterToolCall', toolArgs, functionResponse);
        });
        const result = await conv.streamPrompt('Analyze smyth runtime dependencies and tell me what S3Storage.class.ts depends on');

        expect(result).toBeDefined();
    }, 30000);

    it(`runs a conversation remote weather openAPI.json with Model: ${model}`, async () => {
        //TODO: test invalid yaml and json urls
        const specUrl = 'https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/xkcd.com/1.0.0/openapi.yaml';

        const conv = new Conversation(model, specUrl);

        let streamResult = '';
        conv.on('beforeToolCall', (args) => {
            //console.log('beforeToolCall', args);
        });
        conv.on('content', (content) => {
            //console.log('data', content);
            streamResult += content;
        });
        conv.on('afterToolCall', (info, functionResponse) => {
            console.log('afterToolCall', info.tool, functionResponse);
        });
        const result = await conv.streamPrompt('find a random comic and write a short story about it');

        console.log(streamResult);
        expect(result).toBeDefined();
    }, 30000);

    it(
        `runs successive tools calls with Model: ${model}`,
        async () => {
            //const specUrl = 'https://closz0vak00009tsctm7e8xzs.agent.stage.smyth.ai/api-docs/openapi.json';
            const specUrl = 'https://closz0vak00009tsctm7e8xzs.agent.stage.smyth.ai/api-docs/openapi.json';
            const conv = new Conversation(model, specUrl);

            let streamResult = '';
            conv.on('beforeToolCall', (args) => {
                //console.log('beforeToolCall', args);
            });

            conv.on('data', (data) => {
                //console.log('===== data =====');
                //console.log('>>', data);
            });
            conv.on('content', (content) => {
                console.log(content);
                streamResult += content;
            });
            conv.on('start', (content) => {
                console.log('============== Start ====================');
            });
            conv.on('end', (content) => {
                console.log('============== End ====================');
            });

            conv.on('beforeToolCall', (info) => {
                try {
                    console.log('Using tool : ' + info.tool.name);
                } catch (error) {}
            });
            conv.on('beforeToolCall', async (info) => {
                try {
                    console.log('Got response from tool : ' + info.tool.name);
                } catch (error) {}
            });

            const result = await conv.streamPrompt(
                //'analyze smyth runtime code, implement a Google Cloud storage connector, register it in the storage service, implement the unit tests, and then write a documentation.\n\nif you get stuck somewhere or need confirmation, you can ask me'
                //'search documentation about ldap, then summarize it in a single sentence, then search a documentation about logto, then write a single sentence about it. when you finish say : "FINISHED!!"'
                'search documentation about ldap, then summarize it in a single sentence'
            );
            expect(result).toBeDefined();
        },
        60000 * 10
    );
}

const models = ['claude-3-5-sonnet-20240620', 'gpt-4o'];

for (const model of models) {
    describe(`LLM Tools use for Model: ${model}`, () => {
        runTestCases(model);
    });
}
