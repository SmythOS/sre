import { VectorDB, Model, AccessCandidate } from '@smythos/sdk';
import dotenv from 'dotenv';

import { Doc } from '@smythos/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, '../files/bitcoin.pdf');

dotenv.config();

function logMemoryUsage(label: string) {
    const usage = process.memoryUsage();
    const formatBytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

    console.log(`\n=== Memory Usage (${label}) ===`);
    console.log(`RSS: ${formatBytes(usage.rss)} (Resident Set Size)`);
    console.log(`Heap Used: ${formatBytes(usage.heapUsed)}`);
    console.log(`Heap Total: ${formatBytes(usage.heapTotal)}`);
    console.log(`External: ${formatBytes(usage.external)}`);
    console.log(`Array Buffers: ${formatBytes(usage.arrayBuffers)}`);
    console.log('===============================\n');
}

async function main() {
    const pinecone = VectorDB.Pinecone('test', {
        indexName: 'demo-vec',

        apiKey: process.env.PINECONE_API_KEY,
        embeddings: Model.OpenAI('text-embedding-3-large'),
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

// Log memory usage before main execution
logMemoryUsage('Before Main');

main()
    .then(() => {
        // Log memory usage after main execution
        logMemoryUsage('After Main');
    })
    .catch(console.error);
