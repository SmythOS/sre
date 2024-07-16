import fs from 'fs';
import { describe, expect, it } from 'vitest';
import { S3Storage } from '@sre/IO/Storage.service/connectors/S3Storage.class';
import { RedisCache } from '@sre/MemoryManager/Cache.service/connectors/RedisCache.class';
import config from '@sre/config';
import { AgentRequest, SmythRuntime } from '@sre/index';
import { IAgentDataConnector } from '@sre/AgentManager/AgentData.service/IAgentDataConnector';
import { AgentProcess } from '@sre/Core/AgentProcess.helper';
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
    Cache: {
        Connector: 'Redis',
        Settings: {
            hosts: config.env.REDIS_SENTINEL_HOSTS,
            name: config.env.REDIS_MASTER_NAME || '',
            password: config.env.REDIS_PASSWORD || '',
        },
    },
});
describe('AgentProcess Tests', () => {
    it('Runs Agent From data with run() method', async () => {
        let error;
        try {
            const sre = SmythRuntime.Instance;
            const agentData = fs.readFileSync('./tests/data/sre-openai-LLMPrompt.smyth', 'utf-8');
            const data = JSON.parse(agentData);

            const output = await AgentProcess.load(data).run({
                method: 'POST',
                path: '/api/say',
                body: { message: 'Write a poem about flowers, the word "Rose" should be mentioned at least once' },
            });
            expect(JSON.stringify(output)?.toLowerCase()).toContain('rose');
        } catch (e) {
            error = e;
        }
        expect(error).toBeUndefined();
    });

    it('Runs Agent From data with post() method', async () => {
        let error;
        try {
            const sre = SmythRuntime.Instance;
            const agentData = fs.readFileSync('./tests/data/sre-openai-LLMPrompt.smyth', 'utf-8');
            const data = JSON.parse(agentData);

            const output = await AgentProcess.load(data).post('/api/say', {
                message: 'Write a poem about flowers, the word "Rose" should be mentioned at least once',
            });
            expect(JSON.stringify(output)?.toLowerCase()).toContain('rose');
        } catch (e) {
            error = e;
        }
        expect(error).toBeUndefined();
    });

    it('Runs Agent using CLI arguments', async () => {
        let error;
        try {
            const argv = [
                '--agent',
                './tests/data/sre-APIEndpoint-test.smyth',
                '--endpoint',
                'file',
                '--post',
                `query={\\"message\\":\\"Hello Smyth\\"}`,
                'data=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAL0SURBVHgBvVVNSBRxFH8za26huNvBjyJRcBGkSEkwVKrdyKxLQkQdKvWQRNJetDolruSxRfqgS0K6GkGCRJ1ck9YO7ilxwz0oCoUdUi+uKLaEO77ff3fG2Y85yewP/szMm8f7vY/fm5Eoge6dSSdZpF5SpBoixU4HhUQBIsuQN9c1HH8ESXTSw7e9ZAJipPQNWJs8UtfOVLskK+/IROzGFJcsWZQ2MhkWHolMCjnJbChUI1N2YM8xehPd2KLI71Vxtdrzqai6wjDKWmhZ+AGlF6oz+uRkIph55qPw6ATfb2v2grJicj3vJMe1Rs3249U4BfuH0/xO3W2m+p7WpLiWhp5Wj97w4Zyblr7M0O6//6KSvOKjFI1si7MwFiBbeYmobt43QVPuF5rfsboq3hWJNrkLK99Dwnb8bJUWN2lGqGTt57K45wSoY+E9dSzGj62sRNi/PXojqg6P+MUz7PC7Nemle4ujdOJ8vHWzXK1h68IjE+KK9tQ/bU1qR/PgY/rY1C1I5plEnQkyt9rzNN+rg094tn+FPSMRXqJsQM1Kj1K2gRA+6zx8JLPO1a+Fluht5W06yXOBD8QAv1RoRJu/VjWjkcKsNmTJSoxsUa37gahq9vW4IA/2+yhIxmLQZlRQvp+FntQIaI3L2ynm50yoETaQzjApZpmR6LAtX+sr2pEKtHY9IZTC0xUiIA4qqHVfp5axPnq4+kmTvyqWNCKQIIBwGvWLwHrMvtxXkaOlUcwFJ8hK1UOdL9qqCgZIUh0U46u7LxwGK+/wgC+LuUDyf3g3gDOcfREnhICwoU1ICs8QCRYdKKp2JClP6o5+VfRkCPr5Rm9aRQCIr3AyANoGuWfyw27d5L3Sqy+NSA2yMh0SGw6gKkdLg5BvKsI+f/xbF4m3qZAVC9Xpd8uQyAxk6zchiDYoC5D5gztHZkOhgEy7Sh+ZDZmGZO+RpgD/RzxkEhSO7c29NCyphq4df7skyW3cSicdHBvMMBezyJ6BQxenYdgDBGBJ8gYMOa8AAAAASUVORK5CYII=',
            ];
            const agentData = fs.readFileSync('./tests/data/sre-APIEndpoint-test.smyth', 'utf-8');
            const data = JSON.parse(agentData);

            const output = await AgentProcess.load(data).run(argv);
            expect(output?.binary?.url).toBeDefined();
        } catch (e) {
            error = e;
        }
        expect(error).toBeUndefined();
    });
});
