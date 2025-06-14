/**
 * SRE CLI Entry Point
 * Oclif CLI runner with better error handling
 */

import { run } from '@oclif/core';
import chalk from 'chalk';
import updateNotifier from 'update-notifier';
import { version } from '../package.json';
import { banner } from './ascii';

// Check for updates
const notifier = updateNotifier({
    pkg: { name: '@smythos/cli', version },
    updateCheckInterval: 1000 * 60 * 60 * 24, // Check daily
    shouldNotifyInNpmScript: false,
});

// Show update notificationAdd commentMore actions
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

// Run the Oclif CLI with better error handling
(async () => {
    try {
        await run(process.argv.slice(2), import.meta.url);
    } catch (error: any) {
        // Handle different types of errors gracefully
        if (error.oclif?.exit !== undefined) {
            // This is an Oclif error (like missing args, invalid commands, etc.)
            if (error.message) {
                console.error(chalk.red('❌ Error:'), chalk.gray(error.message));
            }

            // Show helpful guidance based on error type
            if (error.message?.includes('Missing') && error.message?.includes('required arg')) {
                console.error('');
                console.error(chalk.yellow('💡 Tip:'), chalk.gray('Make sure to provide all required arguments'));
                console.error(chalk.blue('   Example:'), chalk.cyan('sre agent ./myagent.smyth --chat'));
            } else if (error.message?.includes('not found')) {
                console.error('');
                console.error(chalk.yellow('💡 Available commands:'));
                console.error(chalk.cyan('   sre agent <path> <mode>'));
                console.error(chalk.cyan('   sre create'));
                console.error(chalk.cyan('   sre update'));
            }

            console.error('');
            console.error(chalk.blue('📖 For detailed help, run:'));
            console.error(chalk.cyan('   sre --help'));
            console.error(chalk.cyan('   sre <command> --help'));

            process.exit(error.oclif.exit);
        } else {
            // This is an unexpected error
            console.error(chalk.red('❌ Unexpected error:'));
            console.error(chalk.gray(error.message || String(error)));
            console.error('');
            console.error(chalk.blue('💡 For help, run:'));
            console.error(chalk.cyan('   sre --help'));
            process.exit(1);
        }
    }
})();
