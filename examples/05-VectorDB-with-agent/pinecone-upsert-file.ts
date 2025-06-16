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
    const pinecone = VectorDB.Pinecone('crypto-ns', {
        indexName: 'demo-vec',

        pineconeApiKey: process.env.PINECONE_API_KEY,
        embeddings: Model.OpenAI('text-embedding-3-large'),
    });

    // This will wipe all the data in 'crypto-ns' namespace
    // !!!! This is a destructive operation, only do it if you want to wipe the data
    await pinecone.purge();

    const doc = Doc.pdf(filePath);

    const parsedDoc = await doc.parse();

    const result = await pinecone.insertDoc(parsedDoc.title, parsedDoc, { myEntry: 'My Metadata' });
    console.log(result);
    const searchResult = await pinecone.search('Proof-of-Work', { topK: 10 });
    console.log(searchResult);

    console.log('done');
}

main();
