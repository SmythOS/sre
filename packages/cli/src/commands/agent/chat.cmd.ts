import { Agent, Chat, TLLMEvent } from '@smythos/sdk';
import chalk from 'chalk';
import readline from 'readline';
import logUpdate from 'log-update';

export default async function runChat(args: any, flags: any) {
    const agentPath = args.path;
    const model = flags.chat === 'DEFAULT_MODEL' ? 'gpt-4o' : flags.chat;

    const agent = Agent.import(agentPath, { model });
    console.log(chalk.white('\nYou are now chatting with agent : ') + chalk.bold.green(agent.data?.name));
    console.log(chalk.white('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    const chat = agent.chat();

    // Create readline interface for user input
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.blue('\n\n You: '),
    });

    // Set up readline event handlers
    rl.on('line', (input) => handleUserInput(input, rl, chat));

    rl.on('close', () => {
        console.log(chalk.gray('Chat session ended.'));
        process.exit(0);
    });

    // Start the interactive chat
    rl.prompt();
}

// Function to handle user input and chat response
async function handleUserInput(input: string, rl: readline.Interface, chat: Chat) {
    if (input.toLowerCase().trim() === 'exit' || input.toLowerCase().trim() === 'quit') {
        console.log(chalk.green('👋 Goodbye!'));
        rl.close();
        return;
    }

    if (input.trim() === '') {
        rl.prompt();
        return;
    }

    try {
        logUpdate(chalk.gray('Thinking...'));

        const assistantName = chat.agentData.name || 'AI';
        // Send message to the agent and get response
        const streamChat = await chat.prompt(input).stream();

        let response = '';
        const gradientLength = 10;
        const gradient = [
            chalk.rgb(200, 255, 200),
            chalk.rgb(170, 255, 170),
            chalk.rgb(140, 240, 140),
            chalk.rgb(110, 225, 110),
            chalk.rgb(85, 221, 85),
            chalk.rgb(60, 200, 60),
            chalk.rgb(0, 187, 0),
            chalk.rgb(0, 153, 0),
            chalk.bold.rgb(0, 130, 0),
            chalk.bold.rgb(0, 119, 0),
        ];

        let typing = Promise.resolve();
        let streamingStarted = false;
        let toolCallMessages: string[] = [];

        const renderResponse = () => {
            const prefix = chalk.green(`\n🤖 ${assistantName}\n`);
            const nonGradientPart = response.slice(0, -gradientLength);
            const gradientPart = response.slice(-gradientLength);

            let coloredGradientPart = '';
            for (let j = 0; j < gradientPart.length; j++) {
                const colorIndex = gradient.length - gradientPart.length + j;
                const color = gradient[colorIndex] || chalk.white;
                coloredGradientPart += color(gradientPart[j]);
            }

            logUpdate(`${prefix}${chalk.white(nonGradientPart)}${coloredGradientPart}`);
        };

        streamChat.on(TLLMEvent.Content, (content) => {
            if (content.length === 0) return;

            if (!streamingStarted) {
                streamingStarted = true;
                toolCallMessages = []; // Clear tool messages
                response = ''; // Clear any previous state.
            }

            typing = typing.then(
                () =>
                    new Promise((resolve) => {
                        let i = 0;
                        const intervalId = setInterval(() => {
                            if (i >= content.length) {
                                clearInterval(intervalId);
                                resolve();
                                return;
                            }

                            response += content[i];
                            renderResponse();
                            i++;
                        }, 5); // 10ms interval for faster typing
                    })
            );
        });

        streamChat.on(TLLMEvent.End, async () => {
            await typing;
            if (streamingStarted) {
                // Final render with all white text
                logUpdate(chalk.green(`\n🤖 ${assistantName}\n`) + chalk.white(response));
            }
            logUpdate.done();
            rl.prompt();
        });

        streamChat.on(TLLMEvent.Error, async (error) => {
            await typing;
            logUpdate.clear();
            console.error(chalk.red('❌ Error:', error));
            rl.prompt();
        });

        streamChat.on(TLLMEvent.ToolCall, async (toolCall) => {
            await typing;

            const toolMessage = `${chalk.yellowBright('[Calling Tool]')} ${toolCall?.tool?.name} ${chalk.gray(
                typeof toolCall?.tool?.arguments === 'object' ? JSON.stringify(toolCall?.tool?.arguments) : toolCall?.tool?.arguments
            )}`;
            toolCallMessages.push(toolMessage);
            logUpdate(toolCallMessages.join('\n'));
        });

        streamChat.on(TLLMEvent.ToolResult, async () => {
            await typing;

            const thinkingMessage = chalk.gray('Thinking...');
            // If we're not already showing "Thinking...", replace previous messages with it.
            if (toolCallMessages.length !== 1 || toolCallMessages[0] !== thinkingMessage) {
                toolCallMessages = [thinkingMessage];
                logUpdate(toolCallMessages.join('\n'));
            }
        });
    } catch (error) {
        logUpdate.clear();
        console.error(chalk.red('❌ Error:', error));
        rl.prompt();
    }
}
