/**
 * SRE CLI Entry Point
 * Oclif CLI runner with better error handling
 */
import { suppressWarnings } from './warnings-override';

suppressWarnings();

import { run } from '@oclif/core';
import chalk from 'chalk';
import updateNotifier from 'update-notifier';
import { version } from '../package.json';
import pkg from '../package.json';
import { getPackageManager } from './utils/getPackageManager';

// Run the Oclif CLI with better error handling
(async () => {
    try {
        // Check for updates before running command (non-blocking)
        //const updateCheckPromise = Promise.resolve().then(() => checkForUpdates());

        await run(process.argv.slice(2), import.meta.url);

        // Ensure update notification is shown
        await checkForUpdates();
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

function checkForUpdates() {
    try {
        // Check for updates (non-blocking notification)
        const notifier = updateNotifier({
            pkg: { name: '@smythos/cli', version },
            updateCheckInterval: 1000 * 60 * 60 * 24, // Check daily (production)
            shouldNotifyInNpmScript: false,
        });

        // Only show notification if update is available
        if (notifier.update) {
            const { latest, current } = notifier.update;
            const packageManager = getPackageManager();
            const pkgName = pkg.name;

            let updateCommand = `npm i -g ${pkgName}`;
            if (packageManager === 'pnpm') {
                updateCommand = `pnpm i -g ${pkgName}`;
            } else if (packageManager === 'yarn') {
                updateCommand = `yarn global add ${pkgName}`;
            }

            const message =
                chalk.bold('Update available ') +
                chalk.dim(current) +
                chalk.reset(' → ') +
                chalk.green(latest) +
                ' \nRun ' +
                chalk.cyan(updateCommand) +
                ' to update';

            notifier.notify({
                isGlobal: true,
                defer: true,
                message,
                boxenOptions: {
                    padding: 1,
                    margin: 1,
                    textAlignment: 'center',
                    borderColor: 'green',
                    borderStyle: 'round',
                },
            });
        }
    } catch (error) {
        // Silently fail - update checks shouldn't break CLI
    }
}
