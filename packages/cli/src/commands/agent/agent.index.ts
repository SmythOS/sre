/**
 * Agent Command - Oclif Implementation
 * Run .smyth agent with various execution modes
 */

import { Args, Command, Flags, Help } from '@oclif/core';
import { Agent } from '@smythos/sdk';
import chalk from 'chalk';
import util from 'util';
import runChat from './chat.cmd';
import runSkill from './skill.cmd';
import runPrompt from './prompt.cmd';
import { startMcpServer } from './mcp.cmd';
import { validateJSONFile } from '../../utils/validations.utils';
import { SRE } from '@smythos/sre';
export default class AgentCmd extends Command {
    static override description = 'Run .smyth agent with various execution modes';

    static override examples = [
        '<%= config.bin %> <%= command.id %> ./myagent.smyth --chat',
        '<%= config.bin %> <%= command.id %> ./myagent.smyth --prompt "What is the weather in Tokyo?"',
        '<%= config.bin %> <%= command.id %> ./myagent.smyth --skill ask question="who are you"',
        '<%= config.bin %> <%= command.id %> ./myagent.smyth --mcp sse',
    ];

    static override usage = '<path> [options]';

    static override args = {
        path: Args.string({
            description: 'Path to the agent file (.smyth)',
            required: false,
        }),
    };

    static override flags = {
        help: Flags.help({ char: 'h' }),
        chat: Flags.string({
            char: 'c',
            description: 'Start chat interface\n\n ',
            helpValue: '[model-name]',
        }),
        models: Flags.string({
            char: 'M',
            description: 'A list of models to use in a json file or directory of json files\n\n ',
            helpValue: '<models> [options]',
        }),
        skill: Flags.string({
            char: 's',
            description: 'Execute an Agent skill, you can pass input parameters as key="value" pairs\n\n ',
            helpValue: '<skill> [key1="value1" ...]',

            multiple: true,
        }),

        prompt: Flags.string({
            char: 'p',
            description:
                'Query agent with a prompt, by default it will use the agent model or default to gpt-4o, you can force a model by passing it as a second argument after the prompt\n\n ',

            helpLabel: '--prompt',
            helpValue: '<prompt> [model]',
            multiple: true,
        }),

        mcp: Flags.string({
            description: 'Start MCP server\n\n ',
            helpValue: '[server-type] [port]',
            multiple: true,
        }),

        vault: Flags.string({
            char: 'v',
            description: 'Provide a vault path to use for the agent\nExample: sre ./myagent.smyth --chat --vault ./myvault.json\n\n ',
            helpValue: '<vault-path>',
            helpLabel: '--vault',
            multiple: false,
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
        const sreConfigs: any = {};
        // If no arguments and no flags are provided, show help
        if (!args.path && Object.keys(flags).length === 0) {
            this.log('No agent path provided, showing help...');
            const help = new Help(this.config);
            await help.showHelp(['agent']);
            return;
        }

        this.log(chalk.blue('🚀 Agent command called!'));
        this.log(chalk.gray(`Agent file: ${args.path}`));
        this.log('');
        this.log(chalk.gray('Agent execution modes:'));
        this.log('Args: ', args);
        this.log('Flags: ', flags);

        if (flags.chat) {
            this.log(chalk.cyan('  • Chat mode selected'));
        }

        if (flags.mcp) {
            this.log(chalk.cyan('  • MCP mode selected'));
            this.log(chalk.gray(`    options: ${flags.mcp}`));
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

        let prompt;
        let promptModel;
        if (flags.prompt) {
            this.log(chalk.cyan(`  • Prompt mode: ${flags.prompt}`));

            prompt = Array.isArray(flags.prompt) ? flags.prompt[0] : flags.prompt;
            promptModel = Array.isArray(flags.prompt) ? flags.prompt[1] : '';
            this.log(chalk.gray(`    Prompt: ${prompt}`));
            this.log(chalk.gray(`    Model: ${promptModel}`));
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

        if (flags.vault) {
            this.log(chalk.cyan(`  • Vault mode: ${flags.vault}`));
            const vaultPathValidation = validateJSONFile(flags.vault);
            if (vaultPathValidation.error) {
                this.log(chalk.red(`  • ${vaultPathValidation.error}`));
            } else {
                sreConfigs.Vault = {
                    Connector: 'JSONFileVault',
                    Settings: {
                        file: vaultPathValidation.path,
                    },
                };
            }
        }

        let modelsPath;
        if (flags.models) {
            this.log(chalk.cyan(`  • Models mode: ${flags.models}`));
            const modelsPathValidation = validateJSONFile(flags.models);
            if (modelsPathValidation.error) {
                this.log(chalk.red(`  • ${modelsPathValidation.error}`));
            } else {
                modelsPath = modelsPathValidation.path;
                sreConfigs.ModelsProvider = {
                    Connector: 'JSONModelsProvider',
                    Settings: {
                        models: modelsPath,
                        mode: 'merge',
                    },
                };
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
            mcp: flags.mcp ? parseFlagsarams(flags.mcp) : null,
            prompt,
            promptModel,
            models: modelsPath || null,
        };
        this.log(chalk.gray(`   Flags: ${JSON.stringify(allFlags, null, 2).replace(/\n/g, '\n          ')}`));

        // Initialize SRE with the configs
        SRE.init(sreConfigs);
        await SRE.ready();

        if (flags.skill) {
            await runSkill(args, allFlags);
            return;
        }
        if (flags.chat) {
            await runChat(args, allFlags);
            return;
        }
        if (flags.prompt) {
            await runPrompt(args, allFlags);
            return;
        }
        if (flags.mcp) {
            const serverType = flags.mcp[0] || 'stdio';
            let port = 0;
            try {
                port = parseInt(flags.mcp[1]);
            } catch (e) {
                port = 3388;
            }
            await startMcpServer(args.path, serverType, port, flags);
            return;
        }
    }
}

function parseFlagsarams(flags: string[]) {
    const parsed: Record<string, string> = {};
    for (const flag of flags) {
        const [key, value] = flag.split('=');
        parsed[key] = value;
    }
    return parsed;
}

