/**
 * SRE CLI Tool - Oclif Implementation
 * Command line interface for SmythOS SRE (Smyth Runtime Environment)
 */

import { Command, Flags } from '@oclif/core';
import { version } from '../package.json';
import updateNotifier from 'update-notifier';
import chalk from 'chalk';

// Check for updates
const notifier = updateNotifier({
    pkg: { name: '@smythos/cli', version },
    updateCheckInterval: 1000 * 60 * 60 * 24, // Check daily
    shouldNotifyInNpmScript: false,
});

// Show update notification
notifier.notify({
    isGlobal: true,
    boxenOptions: {
        padding: 1,
        margin: 1,
        textAlignment: 'center',
        borderColor: 'yellow',
        borderStyle: 'round',
    },
});

/**
 * Main CLI Command
 */
export default class SRE extends Command {
    static override description = 'SmythOS SRE Command Line Interface';

    static override examples = [
        '<%= config.bin %> agent ./myagent.smyth --chat',
        '<%= config.bin %> create',
        '<%= config.bin %> update --check',
        '<%= config.bin %> --help',
    ];

    static override flags = {
        version: Flags.version({ char: 'v' }),
        help: Flags.help({ char: 'h' }),
    };

    async run(): Promise<void> {
        // Show welcome message if no command is provided
        this.log(chalk.blue('👋 Welcome to SRE CLI!'));
        this.log('');
        this.log(chalk.yellow('Available commands:'));
        this.log(chalk.cyan('  sre agent <path> <mode>') + chalk.gray('    # Run .smyth agent file'));
        this.log(chalk.cyan('  sre create') + chalk.gray('              # Create new SRE project'));
        this.log(chalk.cyan('  sre update') + chalk.gray('              # Check for updates'));
        this.log('');
        this.log(chalk.blue('💡 For detailed help on any command, run:'));
        this.log(chalk.cyan('  sre <command> --help'));
        this.log('');
        this.log(chalk.yellow('Quick start:'));
        this.log(chalk.gray('  sre agent ./myagent.smyth --chat'));
        this.log('');
    }
}
