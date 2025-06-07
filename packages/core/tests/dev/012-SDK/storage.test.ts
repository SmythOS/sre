// prettier-ignore-file
import { SmythRuntime, SRE } from '@sre/Core/SmythRuntime.class';
import { LLM, LLMInstance } from '@sre/sdk/LLM.class';
import { Agent, StorageInstance } from '@sre/sdk/sdk.index';
import { Component } from '@sre/sdk/components/components.index';
import { expect, describe, it } from 'vitest';

import { Storage } from '@sre/sdk/Storage.class';

declare module '@sre/types/LLM.types' {
    interface ILLMProviders {
        MyCustomProvider: 'MyCustomProvider';
        AnotherProvider: 'AnotherProvider';
    }
}

declare module '@sre/sdk/types/generated/Storage.types' {
    interface IStorageProviders {
        MyCustomProvider: 'MyCustomProvider';
        AnotherProvider: 'AnotherProvider';
    }
}
SRE.init({
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './tests/data/vault.json',
        },
    },
});

describe('SDK Storage Tests', () => {
    it('Standalone Write file', async () => {
        //const localStorage = new StorageInstance(TStorageProvider.LocalStorage);

        const localStorage = Storage.LocalStorage();

        const result = await localStorage.write('test.txt', 'Hello, world!');

        console.log('done');
    });

    it('Agent Writes file', async () => {
        const agent = new Agent({
            name: 'Test Agent',
            model: 'gpt-4o',
            teamId: '123456',
        });

        const localStorage = agent.storage.LocalStorage();

        const result = await localStorage.write('test2', 'Test Agent');

        console.log('done');
    });
});
