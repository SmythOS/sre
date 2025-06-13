/**
 * Agent Command - Oclif Implementation
 * Run .smyth agent with various execution modes
 */

import { Command, Flags, Args } from '@oclif/core';
import chalk from 'chalk';

export default class Agent extends Command {
    static override description = 'Run .smyth agent with various execution modes';

    static override examples = [
        '<%= config.bin %> <%= command.id %> ./myagent.smyth --chat',
        '<%= config.bin %> <%= command.id %> ./myagent.smyth --skill ask --input question="who are you"',
        '<%= config.bin %> <%= command.id %> ./myagent.smyth --skill ask --input question="who are you" context="testing"',
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
            description: 'Start chat interface',
            helpValue: '[model-name]',
            helpGroup: 'chat',
        }),
        models: Flags.string({
            description: 'A list of models to use in a json file or directory of json files',
            helpValue: '<models> [options]',
            helpGroup: 'models',
        }),
        skill: Flags.string({
            description: 'Execute an Agent skill',
            helpValue: '<skill> [options]',
            helpGroup: 'skill',
        }),
        input: Flags.string({
            description: 'Input parameters for skill execution (key="value" pairs)',
            multiple: true,
            dependsOn: ['skill'],
            helpGroup: 'skill',
        }),

        endpoint: Flags.string({
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

    async run(): Promise<void> {
        const { args, flags } = await this.parse(Agent);

        this.log(chalk.blue('🚀 Agent command called!'));
        this.log(chalk.gray(`Agent file: ${args.path}`));
        this.log('');
        this.log(chalk.gray('Agent execution modes:'));
        this.log('Args: ', args);
        this.log('Flags: ', flags);

        if (flags.chat) {
            this.log(chalk.cyan('  • Chat mode selected'));
        }
        if (flags.skill) {
            this.log(chalk.cyan(`  • Skill mode: ${flags.skill}`));
            if (flags.input) {
                // Parse input parameters from key="value" format
                const parsedInputs = parseFlagsarams(flags.input);
                this.log(chalk.gray(`    Input parameters:`));
                Object.entries(parsedInputs).forEach(([key, value]) => {
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

        if (!flags.chat && !flags.skill && !flags.endpoint) {
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
            skill: flags.skill || null,
            endpoint: flags.endpoint || null,
            input: flags.input ? parseFlagsarams(flags.input) : null,
            get: flags.get ? parseFlagsarams(flags.get) : null,
            post: flags.post ? parseFlagsarams(flags.post) : null,
        };
        this.log(chalk.gray(`   Flags: ${JSON.stringify(allFlags, null, 2).replace(/\n/g, '\n          ')}`));
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
