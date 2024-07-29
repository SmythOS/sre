import dotenv from 'dotenv';
dotenv.config();
process.env.LOG_LEVEL = 'none';

import { AgentRequest, config, AgentProcess, SmythRuntime, ConnectorService, CLIAgentDataConnector } from '../../../dist/index.dev.js';

const sre = SmythRuntime.Instance.init({
    CLI: {
        Connector: 'CLI',
    },
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: process.env.AWS_S3_BUCKET_NAME || '',
            region: process.env.AWS_S3_REGION || '',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
    Cache: {
        Connector: 'Redis',
        Settings: {
            hosts: process.env.REDIS_SENTINEL_HOSTS,
            name: process.env.REDIS_MASTER_NAME || '',
            password: process.env.REDIS_PASSWORD || '',
        },
    },
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './tests/data/vault.json',
        },
    },
    AgentData: {
        Connector: 'CLI',
    },
});

async function main() {
    try {
        //const cliConnector = ConnectorService.getCLIConnector();
        //console.log('CLI Connector:', cliConnector.params);
        const agentDataConnector = ConnectorService.getAgentDataConnector();
        const data = await agentDataConnector.getAgentData('test', '1.0');

        setTimeout(() => {
            console.log('============ Debug Off ============');
            config.env.LOG_LEVEL = 'none';
        }, 1000);
        //console.log(data);
        //const request = new AgentRequest({ method: 'POST', path: '/api/say', body: { message: 'Hello World' } });
        //const request = new AgentRequest(process.argv);
        //const result = await sre.runAgent('test', data, request);

        const result = await AgentProcess.load(data).run(process.argv);

        console.log('>>>>>>>>>>>>>>>>> Result \n', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        await sre._stop();
    }
}

main();
