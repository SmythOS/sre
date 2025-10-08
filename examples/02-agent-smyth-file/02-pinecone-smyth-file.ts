import dotenv from 'dotenv';

import { Agent, Model } from '@smythos/sdk';
import { SRE } from '@smythos/sre';
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();

SRE.init({
    VectorDB: {
        Connector: 'Pinecone',
        Settings: {
            apiKey: process.env.PINECONE_API_KEY,
            //make sure to use the same index name as configured in the SaaS
            indexName: 'dev-test',
            embeddings: {
                provider: 'OpenAI',
                //the saas uses this model for embeddings by default
                model: 'text-embedding-ada-002',
                params: { dimensions: 1536 },
            },
        },
    },
});
const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function main() {
    const agentPath = path.resolve(__dirname, '../agents-data', 'pinecone-agent.smyth');

    //Importing the agent workflow
    const agent = Agent.import(agentPath, {
        model: 'gpt-4o',
        //set the team id explicitly
        teamId: 'team-01d31e56498a54', //team id from the .smyth file
    });

    const searchResult = await agent.prompt(`Search for "healthcare trends" using the /search skill`);
    console.log(searchResult);
}

main();
