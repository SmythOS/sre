import { Agent, Doc, Model } from '@smythos/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const pineconeNamespace = 'crypto-ns';
const pineconeSettings = {
    indexName: 'demo-vec',
    pineconeApiKey: process.env.PINECONE_API_KEY,
    embeddings: Model.OpenAI('text-embedding-3-large'),
};

async function createAgent() {
    const agent = new Agent({
        name: 'CryptoMarket Assistant',
        behavior:
            "You are a helpful assistant who provides information from trusted sources, you can only answer if you find relevant information in our knowledge base, you have to provide the document title, page number and extract of original text after every answer. If you can't find relevant information, tell you user that you cannot answer the question",
        model: 'gpt-4o',
    });

    const skill = agent.addSkill({
        name: 'retrieve-info',
        description: 'Use this skill to retrieve information from our knowledge base. You need to pass the exact user question as a string',
        process: async ({ question }) => {
            const pinecone = agent.vectorDB.Pinecone(pineconeNamespace, pineconeSettings);

            const searchResult = await pinecone.search(question, { topK: 10 });

            return `Below is the retrieved information from our knowledge base, use it to answer the question and provide the document title, page number and extract of original text after every answer: \n\n${JSON.stringify(
                searchResult
            )}`;
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

async function indexDataForAgent(agent: Agent) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(__dirname, '../files/bitcoin.pdf');

    //when you initialize a vectorDB connector from agent scope, the inserted data will be restricted to the agent scope by default
    //other agents cannot access it.
    const pinecone = agent.vectorDB.Pinecone(pineconeNamespace, pineconeSettings);

    // This will wipe all the data in 'crypto-ns' namespace
    // !!!! This is a destructive operation, only do it if you want to wipe the data

    await pinecone.purge();

    const parsedDoc = await Doc.pdf(filePath).parse();

    await pinecone.insertDoc(parsedDoc.title, parsedDoc, { myEntry: 'My Metadata' });
}

async function main() {
    const agent = await createAgent();
    await indexDataForAgent(agent);

    //this will prompt the agent and use the agent's LLM to determine which skill to use
    const promptResult = await agent.prompt('What is bitcoin Proof-of-Work ?');
    //the response comes back in natural language
    console.log(promptResult);
}

main();
