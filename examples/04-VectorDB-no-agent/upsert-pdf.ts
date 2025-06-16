import { VectorDB, Model, AccessCandidate } from '@smythos/sdk';
import dotenv from 'dotenv';

import { Doc } from '@smythos/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, '../files/bitcoin.pdf');

dotenv.config();

async function main() {
    //const ramVectorDB = VectorDB.RAMVec('test');
    //const agentId = '683ee7f8-df9f-4bfc-8dac-864c618b58cb-683ee7f8-df9f-4bfc-8dac-864c618b58cb-683ee7f8-df9f-4bfc-8dac-864c618b58cb';
    const pinecone = VectorDB.Pinecone('test', {
        indexName: 'demo-vec',

        pineconeApiKey: process.env.PINECONE_API_KEY,
        embeddings: Model.OpenAI('text-embedding-3-large'),
    });

    // This will wipe all the data in 'test' namespace
    await pinecone.purge();

    const doc = Doc.pdf(filePath);

    const parsedDoc = await doc.parse();

    const result = await pinecone.insertDoc('test', parsedDoc, { myEntry: 'My Metadata' });
    console.log(result);
    const searchResult = await pinecone.search('Proof-of-Work', { topK: 5 });
    console.log(searchResult);
    const result2 = await pinecone.insertDoc('test', 'Hello, world! 2');
    console.log('2', result2);

    console.log('done');
}

main();
