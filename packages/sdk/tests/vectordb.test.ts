import { describe, it } from 'vitest';

const run = process.env.PINECONE_API_KEY && process.env.OPENROUTER_API_KEY ? it : it.skip;
import { Model, VectorDB } from '../src/index';

describe('SDK VectorDB Tests', () => {
    run('Standalone insert doc', async () => {
        //const ramVectorDB = new VectorDBInstance(TVectorDBProvider.RAMVec, { namespace: 'test' });
        //const ramVectorDB = VectorDB.RAMVec('test');
        const pinecone = VectorDB.Pinecone('test', {
            indexName: 'demo-vec',
            apiKey: process.env.PINECONE_API_KEY || '',
            embeddings: Model.OpenRouter('text-embedding-3-large'),
        });

        console.log(pinecone);

        const result = await pinecone.insertDoc('test', 'Hello, world!');
        console.log(result);
        const searchResult = await pinecone.search('Hello', { topK: 10 });
        console.log(searchResult);
        const result2 = await pinecone.insertDoc('test', 'Hello, world! 2');
        console.log('2', result2);

        console.log('done');
    });
});
