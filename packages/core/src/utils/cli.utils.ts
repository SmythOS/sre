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
