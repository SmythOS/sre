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
    const milvus = VectorDB.Milvus('demo_vec', {
        credentials: {
            address: process.env.MILVUS_ADDRESS,
            user: process.env.MILVUS_USER,
            password: process.env.MILVUS_PASSWORD,
            token: process.env.MILVUS_TOKEN,
        },
        embeddings: Model.OpenAI('text-embedding-3-large'),
    });

    // This will wipe all the data in 'test' namespace
    await milvus.purge();

    const doc = Doc.pdf(filePath);

    const parsedDoc = await doc.parse();

    const result = await milvus.insertDoc('test', parsedDoc, { myEntry: 'My Metadata' });
    console.log(result);
    const searchResult = await milvus.search('Proof-of-Work', { topK: 5 });
    console.log(searchResult);
    const result2 = await milvus.insertDoc('test', 'Hello, world! 2');
    console.log('2', result2);

    console.log('done');
}

main();
