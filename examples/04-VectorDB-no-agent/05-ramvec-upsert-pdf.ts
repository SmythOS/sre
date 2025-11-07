import { VectorDB, Model, AccessCandidate } from '@smythos/sdk';
import dotenv from 'dotenv';

import { Doc } from '@smythos/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, '../files/bitcoin.txt');

dotenv.config();

async function main() {
    //RAMVec is a zero config in memory vector db
    //don't use it for production, you can use it to get started quickly and test your code

    const ramVec = VectorDB.RAMVec('test', {
        embeddings: {
            //provider: 'OpenAI',
            model: Model.OpenAI('text-embedding-3-large'),
            dimensions: 500,
            chunkSize: 1000,
            chunkOverlap: 100,
        },
    });

    // This will wipe all the data in 'test' namespace
    await ramVec.purge();

    const parsedDoc = await Doc.text.parse(filePath);

    const result = await ramVec.insertDoc('test', parsedDoc, { metadata: { myEntry: 'My Metadata' }, chunkSize: 500, chunkOverlap: 50 });
    console.log(result);
    const searchResult = await ramVec.search('Proof-of-Work', { topK: 5 });
    console.log(searchResult);
    const result2 = await ramVec.insertDoc('test', 'Hello, world! 2');
    console.log('2', result2);

    console.log('done');
}

main();
