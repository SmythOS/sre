import { Connector } from '@sre/Core/Connector.class';
import { getMainArgs, parseCLIArgs } from '@sre/utils/cli.utils';

export class CLIConnector extends Connector {
    public name = 'CLI';
    public params: any;
    constructor() {
        super();
        this.params = this.parse(process.argv);
    }

    /**
     * Parses the command line arguments, and returns the parsed arguments object
     * if args is provided, it will only parse the provided args
     * @param argv The command line arguments, usually process.argv
     * @param args The arguments to parse
     * @returns
     */
    public parse(argv: string[], args?: string | string[]) {
        let _keys = args;
        if (_keys && !Array.isArray(_keys)) _keys = [_keys];

        const argsList = _keys || getMainArgs(argv);
        const params = parseCLIArgs(argsList, argv);

        return params;
    }

    /**
     * Get the parsed arguments as an object
     * @param args The arguments to get
     * @returns
     */
    public get(args: string | string[]) {
        let _keys = args;
        if (!Array.isArray(_keys)) _keys = [_keys];

        const result = {};
        _keys.forEach((key) => {
            if (this.params[key]) {
                result[key] = this.params[key];
            }
        });

        return result;
    }
}
