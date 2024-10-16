import 'dotenv/config';
import minimist from 'minimist';
import * as fs from 'fs';
import { parseArgv } from './parseArgv.ts';


///////
//  --json="./path/to/file/json"
//  --method GET --path /api/lyrics --query '{"lyrics":"hello is it me youre looking for"}'
//  --method POST --path /api/lyrics --query '{"lyrics":"hello is it me youre looking for"}' --body '{"name":"John Doe","email":"john@example.com"}'


//============== CLI Args ==============//
const argv = minimist(process.argv.slice(2));
if (argv['v']) { console.log('v0.0.1'); process.exit(); }
if (!argv['agent']) throw Error('You must provide --agent argument');
if (!fs.existsSync(argv['agent'])) throw Error(`Agent at ${argv['agent']} does not exist`);
if (!argv['vault']) throw Error('You must provide --vault argument');
if (!fs.existsSync(argv['vault'])) throw Error(`Vault at ${argv['vault']} does not exist`);


process.env.LOG_LEVEL = 'none';
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
        console.log(process.argv);
        if (!fs.existsSync(argv['json'])) throw Error(`File at ${argv['json']} does not exist`);
        const jsonData = fs.readFileSync(argv['json'], 'utf-8');
        const inputData = JSON.parse(jsonData);
        const output = await AgentProcess.load(data).run({
            method: inputData.method,
            path: inputData.path,
            query: inputData.query,
            body: inputData.body,
        });
        console.log(output?.data);
    } else {
        const av = parseArgv(process.argv);
        console.log(av);
        const output = await AgentProcess.load(data).run(av);
        console.log(output?.data);
    }
})();




// const cliConnector = ConnectorService.getCLIConnector();
// console.log('CLI Connector:', cliConnector.params);
// const agentDataConnector = ConnectorService.getAgentDataConnector();
// const data = await agentDataConnector.getAgentData('test', '1.0');

// setTimeout(() => {
//     console.log('============ Debug Off ============');
//     config.env.LOG_LEVEL = 'none';
// }, 1000);

// //console.log(data);
// //const request = new AgentRequest({ method: 'POST', path: '/api/say', body: { message: 'Hello World' } });
// //const request = new AgentRequest(process.argv);
// //const result = await sre.runAgent('test', data, request);

// const result = await AgentProcess.load(data).run(process.argv);

// console.log('>>>>>>>>>>>>>>>>> Result \n', JSON.stringify(result, null, 2));
