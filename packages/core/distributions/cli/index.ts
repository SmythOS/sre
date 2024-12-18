import 'dotenv/config';
import { Command, Option } from 'commander';
import axios from 'axios';
import os from 'os';
import path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { AgentProcess, config, SmythRuntime } from '../../src/index.js';
import { checkNewVersion, validateFilePath } from './utils.js';

// Get package version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();

program
    .name('smyth')
    .description('Smyth CLI tool for agent management')
    .version('0.0.1', '-v, --version', 'Output the current version')
    .addOption(new Option('-d, --debug <level>', 'Log level').choices(['min', 'full']))
    .requiredOption('--agent <path>', 'Path to the agent file', validateFilePath('Agent'))
    .requiredOption('--endpoint <name>', 'Call endpoint')
    .addOption(new Option('--post <params>', 'Make a POST call').conflicts(['get']))
    .addOption(new Option('--get <params>', 'Make a GET call').conflicts(['post']))
    .option('--vault <path>', 'Path to the vault file', validateFilePath('Vault'))
    .option('--vault-key <path>', 'Path to the vault key file', validateFilePath('Vault Key'))
    .option('--data-path <path>', 'Path to store data');

program.parse();

const options = program.opts();

if (!options.post && !options.get) {
    console.error('Error: Either --post or --get must be specified');
    process.exit(1);
}

// Setup environment

const isVerboseDebug = options.debug == 'full';
if (isVerboseDebug) {
    process.env.LOG_LEVEL = 'debug';
    config.env.LOG_LEVEL = 'debug';
} else if (options.debug == 'min') {
    process.env.LOG_LEVEL = 'info';
    config.env.LOG_LEVEL = 'info';
}

// Setup data path
const dataPath = options.dataPath || path.join(os.tmpdir(), '/.smyth');
if (!fs.existsSync(dataPath)) {
    isVerboseDebug && console.log(`Creating data directory: ${dataPath}`);
    fs.mkdirSync(dataPath, { recursive: true });
}
process.env.DATA_PATH = dataPath;

async function main() {
    try {
        // Initialize runtime
        SmythRuntime.Instance.init({
            CLI: {
                Connector: 'CLI',
            },
            Storage: {
                Connector: 'S3',
                Settings: {},
            },
            Vault: {
                Connector: 'JSONFileVault',
                Settings: {
                    file: options.vault,
                    fileKey: options.vaultKey,
                },
            },
            AgentData: {
                Connector: 'CLI',
            },
            Account: {
                Connector: 'DummyAccount',
                Settings: {},
            },
        });

        // Load and run agent
        const agentData = JSON.parse(fs.readFileSync(options.agent, 'utf-8'));
        agentData.teamId = 'default';

        const output = await AgentProcess.load(agentData).run(process.argv);
        console.log(util.inspect(output?.data, { showHidden: false, depth: null, colors: true }));

        await checkNewVersion();
    } catch (error) {
        console.error('Error:', error.message);

        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
