import 'dotenv/config';
import minimist from 'minimist';
import axios from 'axios';
import os from 'os';
import path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import { help } from './help.ts';


//============== CLI Args ==============//
const argv = minimist(process.argv.slice(2));
try {
    if (argv['v']) { console.log('v0.0.1'); process.exit(); }
    if (argv['d']) { console.log(argv); process.exit(); }
    if (argv['h'] | argv['h']) { help(); process.exit(); }
    //if (!argv['data-path']) argv['data-path'] = process.cwd();
    if (!argv['agent']) throw Error('You must provide --agent argument');
    if (!fs.existsSync(argv['agent'])) throw Error(`Agent at ${argv['agent']} does not exist`);
    //if (!argv['vault']) throw Error('You must provide --vault argument');
    if (argv['vault'] && !fs.existsSync(argv['vault'])) throw Error(`Vault file ${argv['vault']} does not exist`);
    if (argv['vault-key'] && !fs.existsSync(argv['vault-key'])) throw Error(`Vault key file at ${argv['vault-key']} does not exist`);
} catch (error) {
    console.log(error.message);
    process.exit(1);
}


process.env.LOG_LEVEL = 'none';
process.env.DATA_PATH = argv['data-path'];

if (!process.env.DATA_PATH) {
    const dataPath = path.join(os.tmpdir(), '/.smyth');
    console.log(`Using ${dataPath} as data path`);
    fs.mkdirSync(dataPath, { recursive: true });
    process.env.DATA_PATH = dataPath;
    config.env.DATA_PATH = argv['data-path'];
}
process.env.LOG_LEVEL=""
process.env.LOG_FILTER=""
config.env.LOG_LEVEL = process.env.LOG_LEVEL;
config.env.LOG_FILTER = process.env.LOG_FILTER;


import { AgentRequest, config, AgentProcess, SmythRuntime, ConnectorService, CLIAgentDataConnector } from '../../src/index.ts';



//============== Main() ==============//
(async function Main() {
    SmythRuntime.Instance.init({
        CLI: {
            Connector: 'CLI',
        },
        Storage: {
            Connector: 'S3',
            Settings: {

            },
        },
        Vault: {
            Connector: 'JSONFileVault',
            Settings: {
                file: argv['vault'],
                fileKey: argv['vault-key'],
            },
        },
        AgentData: {
            Connector: 'CLI',
        },
        Account: {
            Connector: 'DummyAccount',
            Settings: {

            },
        },
    });

    const agentData = fs.readFileSync(argv['agent'], 'utf-8');
    const data = JSON.parse(agentData);
    data['teamId']='default';

    //console.log(argv);
    const output = await AgentProcess.load(data).run(process.argv);
    console.log(util.inspect(output?.data, { showHidden: false, depth: null, colors: true }));

    checkNewVersion();
})();


async function checkNewVersion() {
    const url = 'https://proxy-02.api.smyth.ai/static/sre/manifest.json';
    const currentVersion = '0.0.1'; // TODO: Get from package.json

    try {
        // Fetch manifest JSON using axios instead of fetch
        const response = await axios.get(url);
        
        if (response.status !== 200) {
            throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
        }

        const manifest = response.data as {
            version: string;
            url: string;
            message: string;
        };

        // Compare versions by splitting into components
        const currentParts = currentVersion.split('.').map(p => parseInt(p, 10));
        const manifestParts = manifest.version.split('.').map(p => parseInt(p, 10));

        let hasNewVersion = false;
        for (let i = 0; i < Math.max(currentParts.length, manifestParts.length); i++) {
            const current = currentParts[i] || 0;
            const manifest = manifestParts[i] || 0;
            if (manifest > current) {
                hasNewVersion = true;
                break;
            } else if (manifest < current) {
                break;
            }
        }

        if (hasNewVersion && manifest.message && manifest.url) {
            console.log('\n=== New Version Available ===');
            console.log(manifest.message);
            console.log(`\nDownload the new version from: ${manifest.url}\n`);
        }

    } catch (error) {
        // Silently handle errors since version check is non-critical
        //console.debug('Failed to check for new version:', error);
    }
}