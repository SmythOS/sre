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
    const pinecone = VectorDB.Pinecone('test', {
        indexName: 'demo-vec',

        apiKey: process.env.PINECONE_API_KEY,
        embeddings: {
            model: Model.OpenAI('text-embedding-3-large'),
        },
    });

    // This will wipe all the data in 'test' namespace
    await pinecone.purge();

    //insert text
    const result = await pinecone.insertDoc('test', 'Hello, world! 2');
    console.log(result);

    //search text
    const searchResult = await pinecone.search('Hello');
    console.log(searchResult);

    console.log('done');
}

main();
