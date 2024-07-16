import { execSync } from 'child_process';
import { describe, expect, it } from 'vitest';

function runCLICommand(args: string): string {
    const cmd = `node ./tests/build/cli/sre-cli.js ${args}`;
    return execSync(cmd, { encoding: 'utf-8' });
}

describe('CLI Tests', () => {
    it('Echo agent', () => {
        const timestamp = new Date().getTime();
        const message = `Hello Smyth, timestamp=${timestamp}`;
        const args = `--agent ./tests/data/sre-echo-agent.smyth --endpoint say --post message="${message}"`;
        const output = runCLICommand(args);

        expect(output).toContain(message);
    });

    it('APIEndpoint Test', async () => {
        const args = `--agent ./tests/data/sre-APIEndpoint-test.smyth --endpoint file --post query="Hello Smyth" data=".\\tests\\data\\logo.png"`;
        const output = runCLICommand(args);

        expect(output).toBeDefined();
    });

    it('APIEndpoint Test Debug', async () => {
        const args = `--agent ./tests/data/sre-APIEndpoint-test.smyth --endpoint file --post query="Hello Smyth" data=".\\tests\\data\\logo.png" --headers X-DEBUG-RUN=`;
        const output = runCLICommand(args);

        expect(output).toBeDefined();
    });
    it('APIEndpoint Vision Test', async () => {
        const args = `--agent ./tests/data/sre-APIEndpoint-test.smyth --endpoint describe_image --post image=".\\tests\\data\\dexter-avatar.png"`;
        const output = runCLICommand(args);

        expect(output).toBeDefined();
    });
    it('APIEndpoint Test with encoded binary data', async () => {
        const base64Data =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAYAAACpSkzOAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAL0SURBVHgBvVVNSBRxFH8za26huNvBjyJRcBGkSEkwVKrdyKxLQkQdKvWQRNJetDolruSxRfqgS0K6GkGCRJ1ck9YO7ilxwz0oCoUdUi+uKLaEO77ff3fG2Y85yewP/szMm8f7vY/fm5Eoge6dSSdZpF5SpBoixU4HhUQBIsuQN9c1HH8ESXTSw7e9ZAJipPQNWJs8UtfOVLskK+/IROzGFJcsWZQ2MhkWHolMCjnJbChUI1N2YM8xehPd2KLI71Vxtdrzqai6wjDKWmhZ+AGlF6oz+uRkIph55qPw6ATfb2v2grJicj3vJMe1Rs3249U4BfuH0/xO3W2m+p7WpLiWhp5Wj97w4Zyblr7M0O6//6KSvOKjFI1si7MwFiBbeYmobt43QVPuF5rfsboq3hWJNrkLK99Dwnb8bJUWN2lGqGTt57K45wSoY+E9dSzGj62sRNi/PXojqg6P+MUz7PC7Nemle4ujdOJ8vHWzXK1h68IjE+KK9tQ/bU1qR/PgY/rY1C1I5plEnQkyt9rzNN+rg094tn+FPSMRXqJsQM1Kj1K2gRA+6zx8JLPO1a+Fluht5W06yXOBD8QAv1RoRJu/VjWjkcKsNmTJSoxsUa37gahq9vW4IA/2+yhIxmLQZlRQvp+FntQIaI3L2ynm50yoETaQzjApZpmR6LAtX+sr2pEKtHY9IZTC0xUiIA4qqHVfp5axPnq4+kmTvyqWNCKQIIBwGvWLwHrMvtxXkaOlUcwFJ8hK1UOdL9qqCgZIUh0U46u7LxwGK+/wgC+LuUDyf3g3gDOcfREnhICwoU1ICs8QCRYdKKp2JClP6o5+VfRkCPr5Rm9aRQCIr3AyANoGuWfyw27d5L3Sqy+NSA2yMh0SGw6gKkdLg5BvKsI+f/xbF4m3qZAVC9Xpd8uQyAxk6zchiDYoC5D5gztHZkOhgEy7Sh+ZDZmGZO+RpgD/RzxkEhSO7c29NCyphq4df7skyW3cSicdHBvMMBezyJ6BQxenYdgDBGBJ8gYMOa8AAAAASUVORK5CYII=';
        const args = `--agent ./tests/data/sre-APIEndpoint-test.smyth --endpoint file --post query="{\\"message\\":\\"Hello Smyth\\"}" data="${base64Data}"`;
        const output = runCLICommand(args);

        expect(output).toBeDefined();
    });

    it('APIEndpoint Test with url data', async () => {
        const url = 'https://smythos.com/wp-content/themes/generatepress_child/img/smythos-light.svg';
        const args = `--agent ./tests/data/sre-APIEndpoint-test.smyth --endpoint file --post query="{\\"message\\":\\"Hello Smyth\\"}" data="${url}"`;
        const output = runCLICommand(args);

        expect(output).toBeDefined();
    });

    it('LLMPrompt Test', async () => {
        const args = `--agent ./tests/data/sre-openai-LLMPrompt.smyth --endpoint say --post message="Write a poem about flowers"`;
        const output = runCLICommand(args);

        expect(JSON.stringify(output)).toContain('flowers');
    });
});
