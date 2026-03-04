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

    const parsedDoc = await Doc.pdf.parse(filePath);

    const result = await pinecone.insertDoc('test', parsedDoc, { metadata: { myEntry: 'My Metadata' }, returnFullVectorInfo: true });
    console.log(result);
    const searchResult = await pinecone.search('Proof-of-Work', { topK: 5 });
    console.log(searchResult);
    const result2 = await pinecone.insertDoc('test', 'Hello, world! 2');
    console.log('2', result2);

    console.log('done');
}

main();
