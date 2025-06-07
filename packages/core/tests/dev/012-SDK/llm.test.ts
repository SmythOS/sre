// prettier-ignore-file
import { SmythRuntime, SRE } from '@sre/Core/SmythRuntime.class';
import { LLM, LLMInstance } from '@sre/sdk/LLM.class';
import { Agent } from '@sre/sdk/sdk.index';
import { Component } from '@sre/sdk/components/components.index';
import { expect, describe, it } from 'vitest';

import { TLLMProvider } from '@sre/types/LLM.types';

declare module '@sre/types/LLM.types' {
    interface ILLMProviders {
        MyCustomProvider: 'MyCustomProvider';
        AnotherProvider: 'AnotherProvider';
    }
}
// SRE.init({
//     Vault: {
//         Connector: 'JSONFileVault',
//         Settings: {
//             file: './tests/data/vault.json',
//         },
//     },
// });

describe('SDK LLM Tests', () => {
    it('LLM - Prompt from LLMInstance', async () => {
        //initialize the LLM
        const llm = new LLMInstance(TLLMProvider.OpenAI, { model: 'gpt-4o' });

        //direct prompt
        const result = await llm.prompt('What is the capital of France?');

        expect(result).toBeDefined();
        expect(result).toContain('Paris');
    });

    it('LLM - Prompt from named LLM', async () => {
        const llm = LLM.OpenAI('gpt-4o-mini');

        const result = await llm.prompt('What is the capital of France?');

        expect(result).toBeDefined();
        expect(result).toContain('Paris');
    });

    it('LLMProxy - Chat', async () => {
        const llm = LLM.OpenAI({ model: 'gpt-4o' });

        const chat = llm.chat();
        const result2 = await chat.prompt('Hi my name is John Doe. What is the capital of France?');

        const result3 = await chat.prompt('Do you remember my name ?');

        expect(result2).toBeDefined();
        expect(result2).toContain('Paris');
        expect(result3).toBeDefined();
        expect(result3).toContain('John Doe');
    });

    it('LLM - StreamPrompt', async () => {
        const llm = LLM.OpenAI({ model: 'gpt-4o' });

        const eventEmitter = await llm.prompt('What is the capital of France?').stream();

        let result = '';
        eventEmitter.on('content', (content) => {
            result += content;
        });

        // Wait for the stream to complete
        await new Promise((resolve, reject) => {
            eventEmitter.on('end', () => {
                console.log('Stream completed');
                resolve(undefined);
            });
            eventEmitter.on('error', (error) => {
                reject(error);
            });
        });

        expect(result).toBeDefined();
        expect(result).toContain('Paris');
    });
});
