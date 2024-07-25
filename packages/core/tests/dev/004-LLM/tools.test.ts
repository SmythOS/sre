import ToolExecutor from '@sre/helpers/ToolExecutor.class';
import { describe, expect, it } from 'vitest';

import config from '@sre/config';
import { SmythRuntime } from '@sre/index';
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
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './tests/data/vault.json',
        },
    },
});
describe('LLM Tools', () => {
    it('Call tools from openAPI url', async () => {
        const specUrl = 'https://clp1tl4tx00129tq5owb0kfxh.agent.stage.smyth.ai/api-docs/openapi.json';
        const system = `You are a helpful assistant that can answer questions about SmythOS.
if the user asks any question, use /ask endpoint to get information and be able to answer it.`;
        const toolExecutor = new ToolExecutor('gpt-3.5-turbo', specUrl);
        const result = await toolExecutor.run({
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: 'What can you help me with ?' },
            ],
        });

        expect(result).toBeDefined();
    }, 30000);
});
