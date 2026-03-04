import { Agent, MCPTransport, Model, Scope } from '@smythos/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

import { SRE } from '@smythos/sdk/core';

SRE.init({
    //Telemetry Service configuration
    Telemetry: {
        Connector: 'OTel', //we use OTel (OpenTelemetry) connector
        Settings: {
            endpoint: 'http://localhost:4318',

            //Optional settings
            //serviceName: 'smythos',
            //serviceVersion: '1.0.0',
            // headers: {
            //     'Authorization': 'Bearer your-api-key',
            // }
        },
    },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function main() {
    //.smyth file path
    const agentPath = path.resolve(__dirname, '../agents-data', 'crypto-info-agent.smyth');

    //Importing the agent workflow
    const agent = Agent.import(agentPath, {
        model: Model.OpenAI('gpt-4o'),
    });

    const result = await agent.prompt('What are the current prices of Bitcoin and Ethereum ?');

    console.log(result);
}

main();
