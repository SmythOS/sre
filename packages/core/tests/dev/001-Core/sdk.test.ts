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
SRE.init({
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './tests/data/vault.json',
        },
    },
});

describe('SDK Tests', () => {
    it('LLMProxy - prompt', async () => {
        //initialize the LLM
        const llm = new LLMInstance(TLLMProvider.OpenAI, { model: 'gpt-4o' });
        const llm2 = LLM.OpenAI({ model: 'gpt-4o' });

        // ## Syntax 1 ================================================
        //direct prompt
        const result = await llm.prompt('What is the capital of France?');

        const chat = llm.chat();
        const result2 = await chat.prompt('What is the capital of France?');
        console.log(result2);

        const result3 = await chat.prompt('What was my previous question?');
        console.log(result3);

        //const convContext = llm.conversation('123456');
        //convContext.prompt('What is the capital of France?').stream();

        console.log(result);
    });

    it('LLMProxy - streamPrompt', async () => {
        //initialize the LLM
        const llm = new LLMInstance(TLLMProvider.OpenAI, { model: 'gpt-4o' });

        // ## Syntax 1 ================================================
        //prompt and stream the result
        const eventEmitter = await llm.prompt('What is the capital of France?').stream();

        eventEmitter.on('content', (content) => {
            console.log('>>>>>>', content);
        });

        // Wait for the stream to complete
        return new Promise((resolve, reject) => {
            eventEmitter.on('end', () => {
                console.log('Stream completed');
                resolve(undefined);
            });
            eventEmitter.on('error', (error) => {
                reject(error);
            });
        });
    });

    it('SDK declarative', async () => {
        const agent = new Agent({
            name: 'SRE Assistant',
            behavior:
                'You are a helpful assistant that can answer any user question. It is important to use "Answer" skill in order to answer any user question',
            model: 'gpt-4o',
        });

        //create a skill
        const skill = agent.addSkill({
            name: 'Answer',
            description: 'Use this skill to answer any user question',
        });
        skill.in({
            question: {
                type: 'string',
                description: 'The question to answer',
                required: true,
            },
        });

        //create openai LLM component
        const openaiCpt = Component.GenAILLM({
            model: 'gpt-4o',
            prompt: 'Answer the following question: {{question}}\n\n Start your answer by "Yohohohohoooo"',
        });
        //connect llm question input to skill question output
        openaiCpt.in({ question: skill.out.body.question });

        const result = await agent.prompt('Hello, what is the capital of France');

        const result2 = await agent.prompt('do you remember my name?');

        // const chat = agent.chat();
        // const result = await chat.prompt('Hello, my name is Aladdin what is the capital of France');

        // const result2 = await chat.prompt('do you remember my name?');

        console.log(result);
        console.log(result2);
    });

    it('SDK procedural', async () => {
        const agent = new Agent({ name: 'Evaluator', model: 'gpt-4o' });

        agent.addSkill({
            name: 'GetSecret',
            description: 'Use this tool to provide a secret based on user info',
            process: async ({ userName, userNumber }) => {
                const secret = `${userNumber * 10}_${userName.substring(0, 3)}`;
                console.log('calculating secret...', secret);
                return { secret };
            },
        });

        const result = await agent.prompt('What is my secret number ? My name is John and my number is 001425');
        console.log(result);

        //console.log(agent.data);
        expect(agent.data).toBeDefined();
    });
});
