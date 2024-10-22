import 'dotenv/config';
import minimist from 'minimist';
import * as fs from 'fs';
import * as util from 'util';
import { parseArgv } from './parseArgv.ts';
import { help } from './help.ts';


///////
//  --json="./path/to/file/json"
// --method POST --path /api/lyrics --query '{"lyrics":"hello is it me youre looking for"}' --body '{"name":"John Doe","email":"john@example.com"}'
// 
// /Users/anthonybudd/Development/SmythOS/smyth-runtime/distributions/cli/dist/smyth-runtime-macos
// --agent=/Users/anthonybudd/Development/SmythOS/agents/song-guesser.smyth \
// --vault=/Users/anthonybudd/Development/SmythOS/vault.json \
// --method GET \
// --path /api/lyrics \
// --query '{"lyrics":"hello is it me youre looking for"}'



//============== CLI Args ==============//
const argv = minimist(process.argv.slice(2));
if (argv['v']) { console.log('v0.0.1'); process.exit(); }
if (argv['d']) { console.log(argv); process.exit(); }
if (argv['h'] | argv['h']) { help(); process.exit(); }
if (!argv['data-path']) argv['data-path'] = process.cwd();
if (!argv['agent']) throw Error('You must provide --agent argument');
if (!fs.existsSync(argv['agent'])) throw Error(`Agent at ${argv['agent']} does not exist`);
if (!argv['vault']) throw Error('You must provide --vault argument');
if (!fs.existsSync(argv['vault'])) throw Error(`Vault at ${argv['vault']} does not exist`);
if (argv['vault-key'] && !fs.existsSync(argv['vault-key'])) throw Error(`Vault at ${argv['vault-key']} does not exist`);


process.env.LOG_LEVEL = 'none';
process.env.DATA_PATH = argv['data-path'];
import { AgentRequest, config, AgentProcess, SmythRuntime, ConnectorService, CLIAgentDataConnector } from '../../src/index.ts';

config.env.DATA_PATH = argv['data-path'];

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

    if (argv['json']) {
        if (!fs.existsSync(argv['json'])) throw Error(`File at ${argv['json']} does not exist`);
        const jsonData = fs.readFileSync(argv['json'], 'utf-8');
        const inputData = JSON.parse(jsonData);
        const output = await AgentProcess.load(data).run({
            method: inputData.method,
            path: inputData.path,
            query: inputData.query,
            body: inputData.body,
        });
        console.log(util.inspect(output?.data, { showHidden: false, depth: null, colors: true }));
    } else {
        const av = parseArgv(process.argv);
        console.log(av);
        const output = await AgentProcess.load(data).run(av);
        console.log(util.inspect(output?.data, { showHidden: false, depth: null, colors: true }));
    }
})();
