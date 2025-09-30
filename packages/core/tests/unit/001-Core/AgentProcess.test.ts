import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import config from '@sre/config';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { describe, expect, it } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { loadAgentData, testData } from '../../utils/test-data-manager';

setupSRE();

describe('AgentProcess Tests', () => {
    it('Runs Agent From data with run() method', async () => {
        let error;
        let output;
        try {
            // Use the test data manager to load agent data
            const data = loadAgentData('AgentData/sre-echo-LLMPrompt.smyth');

            output = await AgentProcess.load(data).run({
                method: 'POST',
                path: '/api/say',
                body: { message: 'Write a poem about flowers, the word "Rose" should be mentioned at least once' },
            });
        } catch (e) {
            error = e;
        }

        expect(JSON.stringify(output?.data)?.toLowerCase()).toContain('rose');
        expect(error).toBeUndefined();
    });

    it('Runs Agent by ID', async () => {
        let error;
        try {
            //the id here is loaded by the LocalAgentDataConnector when reading the agent data from the agents directory
            const agentId = 'clxjao3wr030tewtu2rk2zh0d';
            const output = await AgentProcess.load(agentId).run({
                method: 'POST',
                path: '/api/say',
                body: { message: 'Write a poem about flowers, the word "Rose" should be mentioned at least once' },
            });
            expect(JSON.stringify(output?.data)?.toLowerCase()).toContain('rose');
        } catch (e) {
            error = e;
        }
        expect(error).toBeUndefined();
    });
    it('Runs Agent by ID, call a sub-agent', async () => {
        let error;
        try {
            //the id here is loaded by the LocalAgentDataConnector when reading the agent data from the agents directory
            const agentId = 'clp1tnwli001h9tq56c9m6i7j';
            const output = await AgentProcess.load(agentId).run({
                method: 'POST',
                path: '/api/ask',
                body: { question: 'What is SmythOS' },
            });

            //TODO: verify a specific response from the sub-agent
            expect(output?.data).toBeDefined();
        } catch (e) {
            error = e;
        }
        expect(error).toBeUndefined();
    });

    it('Runs Agent From data with post() method', async () => {
        let error;
        try {
            const sre = SmythRuntime.Instance;
            // Use the test data manager to load agent data
            const data = loadAgentData('AgentData/sre-echo-LLMPrompt.smyth');

            const output = await AgentProcess.load(data).post('/api/say', {
                message: 'Write a poem about flowers, the word "Rose" should be mentioned at least once',
            });
            expect(JSON.stringify(output?.data)?.toLowerCase()).toContain('rose');
        } catch (e) {
            error = e;
        }
        expect(error).toBeUndefined();
    });

    // it('Runs Agent using CLI arguments', async () => {
    //     let error;
    //     try {
    //         const argv = [
    //             '--agent',
    //             testData.getDataPath('sre-APIEndpoint-test.smyth'),
    //             '--endpoint',
    //             'file',
    //             '--post',
    //             `query={\\"message\\":\\"Hello Smyth\\"}`,
    //             'data=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAL0SURBVHgBvVVNSBRxFH8za26huNvBjyJRcBGkSEkwVKrdyKxLQkQdKvWQRNJetDolruSxRfqgS0K6GkGCRJ1ck9YO7ilxwz0oCoUdUi+uKLaEO77ff3fG2Y85yewP/szMm8f7vY/fm5Eoge6dSSdZpF5SpBoixU4HhUQBIsuQN9c1HH8ESXTSw7e9ZAJipPQNWJs8UtfOVLskK+/IROzGFJcsWZQ2MhkWHolMCjnJbChUI1N2YM8xehPd2KLI71Vxtdrzqai6wjDKWmhZ+AGlF6oz+uRkIph55qPw6ATfb2v2grJicj3vJMe1Rs3249U4BfuH0/xO3W2m+p7WpLiWhp5Wj97w4Zyblr7M0O6//6KSvOKjFI1si7MwFiBbeYmobt43QVPuF5rfsboq3hWJNrkLK99Dwnb8bJUWN2lGqGTt57K45wSoY+E9dSzGj62sRNi/PXojqg6P+MUz7PC7Nemle4ujdOJ8vHWzXK1h68IjE+KK9tQ/bU1qR/PgY/rY1C1I5plEnQkyt9rzNN+rg094tn+FPSMRXqJsQM1Kj1K2gRA+6zx8JLPO1a+Fluht5W06yXOBD8QAv1RoRJu/VjWjkcKsNmTJSoxsUa37gahq9vW4IA/2+yhIxmLQZlRQvp+FntQIaI3L2ynm50yoETaQzjApZpmR6LAtX+sr2pEKtHY9IZTC0xUiIA4qqHVfp5axPnq4+kmTvyqWNCKQIIBwGvWLwHrMvtxXkaOlUcwFJ8hK1UOdL9qqCgZIUh0U46u7LxwGK+/wgC+LuUDyf3g3gDOcfREnhICwoU1ICs8QCRYdKKp2JClP6o5+VfRkCPr5Rm9aRQCIr3AyANoGuWfyw27d5L3Sqy+NSA2yMh0SGw6gKkdLg5BvKsI+f/xbF4m3qZAVC9Xpd8uQyAxk6zchiDYoC5D5gztHZkOhgEy7Sh+ZDZmGZO+RpgD/RzxkEhSO7c29NCyphq4df7skyW3cSicdHBvMMBezyJ6BQxenYdgDBGBJ8gYMOa8AAAAASUVORK5CYII=',
    //         ];
    //         // Use the test data manager to load agent data
    //         const data = loadAgentData('sre-APIEndpoint-test.smyth');

    //         const output: any = await AgentProcess.load(data).run(argv);
    //         expect(output?.data?.binary?.url).toBeDefined();
    //     } catch (e) {
    //         error = e;
    //     }
    //     expect(error).toBeUndefined();
    // });
});
