import { Agent, Doc, Model, Scope, TLLMEvent } from '@smythos/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

// declare module '@smythos/sdk' {
//     interface IVectorDBProviders {
//         Vectra: {
//             indexId: string;
//             apiSecret: string;
//         };
//     }
// }

const pineconeNamespace = 'crypto-ns';
const pineconeSettings = {
    indexName: 'demo-vec',
    apiKey: process.env.PINECONE_API_KEY,
    embeddings: {
        model: Model.OpenAI('text-embedding-3-large'),
        chunkSize: 1000,
        chunkOverlap: 100,
        dimensions: 1024,
    },
    //you can also use Model.GoogleAI('gemini-embedding-001', { dimensions: 1024 })
};

async function createAgent() {
    const agent = new Agent({
        //Important : When you work with services like VectorDB or storage,
        // it's important to identify your agent with an ID if you want to benefit from data isolation
        // this garantees that only your agent has access to the data it inserts or stores
        // if you don't provide an ID, the data will be associated with the team ID
        //You can also explicitly share the data with the agent team by adding Scope.TEAM to your vectorDB initialization
        id: 'crypto-market-assistant',
        name: 'CryptoMarket Assistant',
        behavior: `You are a helpful assistant who provides information from trusted sources. 
You can only answer if you find relevant information in our knowledge base, 
you have to provide the following information after every answer : Document title, Page number, Extract of original text.
If you use multiple sources, provide the above information for each source.
If you can't find relevant information, tell you user that you cannot answer the question`,
        model: 'gpt-4o',
    });

    const skill = agent.addSkill({
        name: 'retrieve-info',
        description: 'Use this skill to retrieve information from our knowledge base.',
        process: async ({ question }) => {
            //Initialize the vectorDB connector with the agent scope (default)
            //we can explicitly set the scope to Scope.TEAM to share the data with the agent team
            const pinecone = agent.vectorDB.Pinecone(pineconeNamespace, pineconeSettings /* ,Scope.TEAM */);

            const searchResult = await pinecone.search(question, { topK: 10 });

            return `Retrieved information : \n\n${JSON.stringify(searchResult)}`;
        },
    });
    skill.in({
        question: {
            type: 'Text',
            description: 'Copy here the exact user question',
        },
    });

    return agent;
}

//This function
async function indexDataForAgent(agent: Agent) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(__dirname, '../files/bitcoin.md');

    //when you initialize a vectorDB connector from agent scope, the inserted data will be restricted to the agent scope by default
    //other agents cannot access it.
    const pinecone = agent.vectorDB.Pinecone(pineconeNamespace, pineconeSettings);

    // This will wipe all the data in 'crypto-ns' namespace
    // !!!! This is a destructive operation, only do it if you want to wipe the data

    await pinecone.purge();

    const parsedDoc = await Doc.md.parse(filePath, {
        title: 'Bitcoin',
        author: 'Satoshi Nakamoto',
        date: '2009-01-03',
        tags: ['bitcoin', 'crypto', 'blockchain'],
    });

    await pinecone.insertDoc(parsedDoc.title, parsedDoc, { metadata: { myEntry: 'My Metadata' } });
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    const agent = await createAgent();
    console.log('Indexing data for agent');
    await indexDataForAgent(agent);

    console.log('Waiting for 5 seconds before prompting the agent ... sometimes the index is not ready immediately');
    await delay(5000);

    console.log('Prompting the agent');

    //this will prompt the agent and use the agent's LLM to determine which skill to use
    const promptStream = await agent.prompt('What is bitcoin Proof-of-Work ?').stream();
    //the response comes back in natural language
    console.log('\n');
    promptStream.on(TLLMEvent.Content, (content) => {
        process.stdout.write(content);
    });
}

main();
