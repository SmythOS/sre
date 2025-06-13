import { Agent, Model } from '@smythos/sdk';
import { SRE } from '@smythos/sre';
import path from 'path';
import { fileURLToPath } from 'url';

SRE.init({
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './tests/data/vault.json',
        },
    },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function main() {
    //In this example we are importing a .smyth file that describes the agent workflow
    // the .smyth file was created with SmythOS builder (https://app.smythos.com/)
    // This agent uses Coingecko API to get crypto market data

    //.smyth file path
    const agentPath = path.resolve(__dirname, '../agents-data', 'crypto-info-agent.smyth');

    //Importing the agent workflow
    const agent = Agent.import(agentPath, {
        model: Model.OpenAI('gpt-4o'),
    });

    const result = await agent.prompt('What are the current prices of Bitcoin and Ethereum ?');

    //const result = await agent.call('get_price', { coin_id: 'bitcoin' });

    console.log(result);
}

main();
