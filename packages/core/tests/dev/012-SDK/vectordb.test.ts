// prettier-ignore-file
import { SmythRuntime, SRE } from '@sre/Core/SmythRuntime.class';
import { LLM, LLMInstance } from '@sre/sdk/LLM.class';
import { Agent, StorageInstance, TVectorDBProvider, VectorDB, VectorDBInstance } from '@sre/sdk/sdk.index';
import { Component } from '@sre/sdk/components/components.index';
import { expect, describe, it } from 'vitest';

import { Storage } from '@sre/sdk/Storage.class';

SRE.init({
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './tests/data/vault.json',
        },
    },
});

describe('SDK VectorDB Tests', () => {
    it('Standalone insert doc', async () => {
        //const ramVectorDB = new VectorDBInstance(TVectorDBProvider.RAMVec, { namespace: 'test' });
        //const ramVectorDB = VectorDB.RAMVec('test');
        const pinecone = VectorDB.Pinecone('test', {
            indexName: 'demo-vec',
            openaiApiKey: undefined,
            pineconeApiKey: '',
            isCustomStorageInstance: false,
            openaiModel: 'text-embedding-3-large',
        });

        console.log(pinecone);

        const result = await pinecone.insertDoc('test', 'Hello, world!');
        console.log(result);
        const searchResult = await pinecone.search('Hello', { topK: 10, includeMetadata: true });
        console.log(searchResult);
        const result2 = await pinecone.insertDoc('test', 'Hello, world! 2');
        console.log('2', result2);

        console.log('done');
    });
});
