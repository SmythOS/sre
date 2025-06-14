/**
 * Agent Command - Oclif Implementation
 * Run .smyth agent with various execution modes
 */

import { Command, Flags, Args } from '@oclif/core';
import { Agent, Chat, Model, TLLMEvent } from '@smythos/sdk';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import util from 'util';
import readline from 'readline';
import logUpdate from 'log-update';

export default class AgentCmd extends Command {
    static override description = 'Run .smyth agent with various execution modes';

    static override examples = [
        '<%= config.bin %> <%= command.id %> ./myagent.smyth --chat',
        '<%= config.bin %> <%= command.id %> ./myagent.smyth --skill ask --skill-input question="who are you"',
        '<%= config.bin %> <%= command.id %> ./myagent.smyth --skill ask --skill-input question="who are you" context="testing"',
        '<%= config.bin %> <%= command.id %> ./myagent.smyth --endpoint answer --get question="hello" context="testing"',
        '<%= config.bin %> <%= command.id %> ./myagent.smyth --endpoint submit --post data="example" mode="test"',
    ];

    static override usage = '<path> [options]';

    static override args = {
        path: Args.string({
            description: 'Path to the agent file (.smyth)',
            required: true,
        }),
    };

    static override flags = {
        help: Flags.help({ char: 'h' }),
        chat: Flags.string({
            char: 'c',
            description: 'Start chat interface',
            helpValue: '[model-name]',
            helpGroup: 'chat',
        }),
        models: Flags.string({
            char: 'M',
            description: 'A list of models to use in a json file or directory of json files',
            helpValue: '<models> [options]',
            helpGroup: 'models',
        }),
        skill: Flags.string({
            char: 's',
            description: 'Execute an Agent skill, you can pass input parameters as key="value" pairs',
            helpValue: '<skill> [key1="value1" ...]',
            helpGroup: 'skill',
            multiple: true,
        }),
        // input: Flags.string({
        //     char: 'i',
        //     description: 'Input parameters for skill execution (key="value" pairs)',
        //     multiple: true,
        //     dependsOn: ['skill'],
        //     helpGroup: 'skill',
        //     helpLabel: '--skill',
        //     helpValue: '<skill> --input [key1="value1" ...]',
        // }),

        prompt: Flags.string({
            char: 'p',
            description: 'Query agent with a prompt',
            helpGroup: 'prompt',
            helpLabel: '--prompt',
            helpValue: '<prompt>',
        }),

        endpoint: Flags.string({
            aliases: ['ep'],
            description: 'Execute Agent endpoint',
            helpValue: '<endpoint> [options]',
            helpGroup: 'endpoint',
        }),

        get: Flags.string({
            description: 'GET parameters for endpoint execution (key="value" pairs)',
            multiple: true,
            dependsOn: ['endpoint'],
            exclusive: ['post'],
            helpGroup: 'endpoint',
        }),
        post: Flags.string({
            description: 'POST parameters for endpoint execution (key="value" pairs)',
            multiple: true,
            dependsOn: ['endpoint'],
            exclusive: ['get'],
            helpGroup: 'endpoint',
        }),
    };

    private _logDisabled = true;
    public log(...args: any[]) {
        if (!this._logDisabled) {
            super.log(...args);
        }
    }

    async run(): Promise<void> {
        const { args, flags } = await this.parse(AgentCmd);

        this.log(chalk.blue('🚀 Agent command called!'));
        this.log(chalk.gray(`Agent file: ${args.path}`));
        this.log('');
        this.log(chalk.gray('Agent execution modes:'));
        this.log('Args: ', args);
        this.log('Flags: ', flags);

        if (flags.chat) {
            this.log(chalk.cyan('  • Chat mode selected'));
        }

        let parsedSkillInputs;
        if (flags.skill) {
            this.log(chalk.cyan(`  • Skill mode: ${flags.skill}`));
            if (Array.isArray(flags.skill) && flags.skill.length > 1) {
                // Parse input parameters from key="value" format
                const inputs = flags.skill.slice(1);
                parsedSkillInputs = parseFlagsarams(inputs);
                this.log(chalk.gray(`    Input parameters:`));
                Object.entries(parsedSkillInputs).forEach(([key, value]) => {
                    this.log(chalk.gray(`      ${key}: "${value}"`));
                });
            }
        }
        if (flags.endpoint) {
            this.log(chalk.cyan(`  • Endpoint mode: ${flags.endpoint}`));
            if (flags.get) {
                // Parse GET parameters from key="value" format
                const parsedParams = parseFlagsarams(flags.get);
                this.log(chalk.gray(`    GET parameters:`));
                Object.entries(parsedParams).forEach(([key, value]) => {
                    this.log(chalk.gray(`      ${key}: "${value}"`));
                });
            }
            if (flags.post) {
                // Parse POST parameters from key="value" format
                const parsedParams = parseFlagsarams(flags.post);
                this.log(chalk.gray(`    POST parameters:`));
                Object.entries(parsedParams).forEach(([key, value]) => {
                    this.log(chalk.gray(`      ${key}: "${value}"`));
                });
            }
        }

        if (!flags.chat && !flags.skill && !flags.endpoint && !flags.prompt) {
            this.log(chalk.yellow('  • No execution mode specified'));
            this.log(chalk.gray('    Use --chat, --skill, or --endpoint'));
        }

        this.log('');
        this.log(chalk.yellow('Features to implement:'));
        this.log(chalk.gray('  • Complex option validation'));
        this.log(chalk.gray('  • Mutually exclusive flags'));
        this.log(chalk.gray('  • Dependent options'));
        this.log(chalk.gray('  • Agent file parsing'));
        this.log('');
        this.log(chalk.green('✅ Agent command parsed successfully! (Implementation pending)'));

        // Show parsed options for debugging
        this.log('');
        this.log(chalk.blue('📋 Parsed Options:'));
        this.log(chalk.gray(`   Path: ${args.path}`));

        // Show all flags with their values (including false booleans)
        const allFlags = {
            chat: flags.chat || false,
            skill: flags?.skill?.[0] || null,
            endpoint: flags.endpoint || null,
            input: parsedSkillInputs || null,
            get: flags.get ? parseFlagsarams(flags.get) : null,
            post: flags.post ? parseFlagsarams(flags.post) : null,
            prompt: flags.prompt || null,
        };
        this.log(chalk.gray(`   Flags: ${JSON.stringify(allFlags, null, 2).replace(/\n/g, '\n          ')}`));

        if (flags.skill) {
            await runSkill(args, allFlags);
            return;
        }
        if (flags.chat) {
            await runChat(args, allFlags);
            return;
        }
    }
}

async function runChat(args: any, flags: any) {
    const agentPath = args.path;
    const model = flags.chat === 'DEFAULT_MODEL' ? 'gpt-4o' : flags.chat;

    const agent = Agent.import(agentPath, { model });
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

async function runSkill(args: any, flags: any) {
    const agentPath = args.path;

    //Importing the agent workflow
    const agent = Agent.import(agentPath);

    const result = await agent.call(flags.skill, flags.input);
    console.log(util.inspect(result, { showHidden: true, depth: null, colors: true }));
}

function parseFlagsarams(flags: string[]) {
    const parsed: Record<string, string> = {};
    for (const flag of flags) {
        const [key, value] = flag.split('=');
        parsed[key] = value;
    }
    return parsed;
}
