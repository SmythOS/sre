import * as readlineSync from 'readline-sync';

/**
 * This function parses the command line arguments and returns an object with the parsed values.
 * The expected format is --file ./path/to/file.txt or --settings key1=value1 key2=value2
 * Examples:
 *  --file ./path/to/file.txt : calling parseCLIArgs('file', process.argv) will return {file: './path/to/file.txt'}
 *  --settings key1=value1 key2=value2 : calling parseCLIArgs('settings', process.argv) will return {settings: {key1: 'value1', key2: 'value2'}}
 *  it can also parse multiple arguments at once, for example:
 *      parseCLIArgs(['file', 'settings'], process.argv) will return {file: './path/to/file.txt', settings: {key1: 'value1', key2: 'value2'}}
 *
 * @param argList the argument to parse
 * @param argv the command line arguments, usually process.argv
 * @returns parsed arguments object
 */

export function parseCLIArgs(argList: string | Array<string>, argv?: Array<string>): Record<string, any> {
    if (!argv) argv = process.argv;
    const args = argv;
    const result = {};
    const mainArgs = Array.isArray(argList) ? argList : [argList];
    mainArgs.forEach((mainArg) => {
        const mainArgIndex = args.indexOf(`--${mainArg}`);
        if (mainArgIndex !== -1) {
            const values: any = [];
            for (let i = mainArgIndex + 1; i < args.length; i++) {
                if (args[i].startsWith('--')) break;
                values.push(args[i]);
            }

            if (values.length === 1 && values[0].includes('=')) {
                const keyValuePairs = {};
                const [key, ...valParts] = values[0].split('=');
                const val = valParts.join('=').replace(/^"|"$/g, '');
                keyValuePairs[key] = val;
                result[mainArg] = keyValuePairs;
            } else if (values.length === 1) {
                result[mainArg] = values[0];
            } else if (values.length > 1) {
                const keyValuePairs = {};
                values.forEach((value) => {
                    const [key, ...valParts] = value.split('=');
                    const val = valParts.join('=').replace(/^"|"$/g, '');
                    keyValuePairs[key] = val;
                });
                result[mainArg] = keyValuePairs;
            }
        }
    });

    return result;
}

/**
 * List all cli main arguments
 * example : node index.js --file ./path/to/file.txt --settings key1=value1 key2=value2
 * calling getMainArgs(process.argv) will return ['file', 'settings']
 */
export function getMainArgs(argv?: Array<string>): Array<string> {
    if (!argv) argv = process.argv;
    const args = argv;
    const result = [];
    for (let i = 2; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            result.push(args[i].replace(/^--/, ''));
        }
    }

    return result;
}

export const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',

    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    orange: '\x1b[33m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',

    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m',
};

/**
 * Prompt the user for a yes/no question synchronously.
 * Returns true for Yes, false for No.
 * Keeps asking until a valid response is entered.
 *
 * @param {string} question - The question to ask (no need to add "(Y/N)").
 * @returns {boolean} - True for yes, false for no.
 */
export function askYesNo(question) {
    while (true) {
        const answer = readlineSync.question(`${question} (Y/N): `).trim().toLowerCase();

        if (['y', 'yes'].includes(answer)) return true;
        if (['n', 'no'].includes(answer)) return false;

        console.log('Please enter Y or N.');
    }
}

/**
 * Prompt the user synchronously for values to populate a JSON object.
 * @param {string} message - Introductory message shown once at the start.
 * @param {Object} prompts - Object where keys are config keys and values are question labels.
 * @returns {Object} - A new object containing the entered values (empty if skipped).
 */
import fs from 'fs';
import { stdin, stdout } from 'process';

export function askForValues(message, prompts, options = {}) {
    console.log(message);

    const result = {};

    // Save original terminal mode
    const wasRaw = stdin.isRaw;

    for (const [key, label] of Object.entries(prompts)) {
        stdout.write(`${label} `);

        // Set terminal to raw mode to capture Ctrl+C
        stdin.setRawMode(true);
        stdin.resume();

        let value = '';
        let cancelled = false;

        const promptLength = (label as string).length + 1;

        while (true) {
            const buffer = Buffer.alloc(1);
            const bytesRead = fs.readSync(stdin.fd, buffer, 0, 1, null);

            if (bytesRead === 0) break;

            const char = buffer.toString('utf8');
            const code = buffer[0];

            // ✅ Check for Ctrl+C (code 3)
            if (code === 3) {
                cancelled = true;
                break;
            }

            // Check for Enter (code 13 or 10)
            if (code === 13 || code === 10) {
                stdout.write('\n');
                break;
            }

            // Check for Backspace (code 127 or 8)
            if (code === 127 || code === 8) {
                if (value.length > 0) {
                    const oldValue = value;
                    value = value.slice(0, -1);

                    // ✅ Calculate lines needed for old and new values
                    const terminalWidth = stdout.columns || 80;
                    const oldTotalLength = promptLength + oldValue.length;
                    const newTotalLength = promptLength + value.length;
                    const oldLines = Math.ceil(oldTotalLength / terminalWidth);
                    const newLines = Math.ceil(newTotalLength / terminalWidth);

                    // Move to start of first line
                    for (let i = 1; i < oldLines; i++) {
                        stdout.write('\x1b[1A'); // Move up
                    }
                    stdout.write('\r'); // Go to start of line

                    // Clear all old lines
                    for (let i = 0; i < oldLines; i++) {
                        stdout.write('\x1b[K'); // Clear line
                        if (i < oldLines - 1) {
                            stdout.write('\n'); // Move to next line to clear it
                        }
                    }

                    // Move back to start
                    for (let i = 1; i < oldLines; i++) {
                        stdout.write('\x1b[1A');
                    }
                    stdout.write('\r');

                    // Redraw prompt and new value
                    stdout.write(`${label} ${value}`);
                }
                continue;
            }

            // Regular character
            if (code >= 32 && code <= 126) {
                value += char;
                stdout.write(char);
            }
        }

        // Restore terminal mode
        stdin.setRawMode(wasRaw);
        stdin.pause();

        if (cancelled) {
            console.log('\n❌ Operation cancelled by user.');
            process.exit(130);
        }

        if (value.trim()) result[key] = value.trim();
    }

    return result;
}
