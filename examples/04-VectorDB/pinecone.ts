import { VectorDB, Model } from '@smythos/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    //const ramVectorDB = VectorDB.RAMVec('test');
    const pinecone = VectorDB.Pinecone('test', {
        indexName: 'demo-vec',

        pineconeApiKey: process.env.PINECONE_API_KEY,
        embeddings: Model.OpenAI('text-embedding-3-large', {
            apiKey: 'fake_key',
        }),
    });

    //console.log(pinecone);

    const result = await pinecone.insertDoc('test', 'Hello, world!');
    console.log(result);
    const searchResult = await pinecone.search('Hello', { topK: 10, includeMetadata: true });
    console.log(searchResult);
    const result2 = await pinecone.insertDoc('test', 'Hello, world! 2');
    console.log('2', result2);

    console.log('done');
}

main();
