// prettier-ignore-file
import { SmythRuntime, SRE } from '@sre/index';
import { LLM } from '@sre/sdk/LLM.class';
import { AgentMaker, LLMProviderMap } from '@sre/sdk/sdk.index';
import { Component } from '@sre/sdk/components/components.index';
import { expect, describe, it } from 'vitest';

// User file can merge:
declare module '@sre/sdk/sdk.index' {
    interface LLMProviderMap {
        groq?: any;
    }
}

SRE.init({
    Storage: {
        Connector: 'Local',
    },
    Cache: {
        Connector: 'RAM',
    },
    AgentData: {
        Connector: 'Local',
        Settings: {
            devDir: './tests/data/AgentData',
            prodDir: './tests/data/AgentData',
        },
    },
    Account: {
        Connector: 'JSONFileAccount',
        Settings: {
            file: './tests/data/account.json',
        },
    },
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
        const llm: any = new LLM('OpenAI', { model: 'gpt-4o' });

        // ## Syntax 1 ================================================
        //direct prompt
        const result = await llm.prompt('What is the capital of France?');

        //const convContext = llm.conversation('123456');
        //convContext.prompt('What is the capital of France?').stream();

        console.log(result);
    });

    it('LLMProxy - streamPrompt', async () => {
        const llm = new LLM('OpenAI', { model: 'gpt-4o' });

        const eventEmitter = await llm.prompt('Write a haiku about sakura trees').stream();

        eventEmitter.on('content', (data) => {
            console.log('>>>>>>', data);
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
        const agentMaker = new AgentMaker({
            name: 'SRE Assistant',
            behavior:
                'You are a helpful assistant that can answer any user question. It is important to use "Answer" skill in order to answer any user question',
            model: 'gpt-4o',
        });

        //create a skill
        const skill = agentMaker.addSkill({
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
            passthrough: true,
        });
        //connect llm question input to skill question output
        openaiCpt.in({ question: skill.out.body.question });

        // const claudeCpt = Component.GenAILLM({ model: 'claude-sonnet-4', prompt: '{{question}}' });
        // claudeCpt.in({ question: skill.out.body.question });

        // const geminiCpt = Component.GenAILLM({ model: 'gemini-flash-2.5', prompt: '{{question}}' });
        // geminiCpt.in({ question: skill.out.body.question });

        // const deepSeekEvalCpt = Component.GenAILLM({ model: 'deepseek-coder', prompt: '... eval prompt ...' });

        // //connect all outputs to the eval LLM
        // deepSeekEvalCpt.in({
        //     question: skill.out.body.question,
        //     openai: openaiCpt.out.Reply,
        //     claude: claudeCpt.out.Reply,
        //     gemini: geminiCpt.out.Reply,
        // });

        const result = await agentMaker.prompt('Hello, what is the capital of France');
        console.log(result);
        //const agent: any = agentMaker.spawn();

        //agent.prompt('What is the capital of France?').stream();
        //agent.chat('123456').prompt('What is the capital of France?').stream();

        //agent.llm.openai('gpt-4o').prompt('What is the capital of France?').stream();

        //const result = await agent.run({ question: 'What is the capital of France?' });
        //console.log(result);

        //console.log(JSON.stringify(agentMaker.data, null, 2));
    });

    it('SDK procedural', async () => {
        const agentMaker: any = new AgentMaker({ name: 'Evaluator', model: 'gpt-4o' });

        agentMaker.addSkill({
            behavior: 'Use this tool to evaluate an answer',
            process: async (input: any) => {
                const openai = agentMaker.llm.openai('gpt-4o');
                const claude = agentMaker.llm.anthropic('sonnet-4');
                const gemini = agentMaker.llm.gemini('flash-2.5');
                const deepseek = agentMaker.llm.deepseek('coder');

                const [gptResponse, claudeResponse, geminiResponse] = await Promise.all([
                    openai.prompt(input),
                    claude.prompt(input),
                    gemini.prompt(input),
                    deepseek.prompt(input),
                ]);

                const result = deepseek.prompt('... eval prompt ...', {
                    openai: gptResponse,
                    claude: claudeResponse,
                    gemini: geminiResponse,
                });

                return result;
            },
        });

        const agent = agentMaker.spawn();
        const result = await agent.run({ question: 'What is the capital of France?' });
        console.log(result);

        console.log(agentMaker.data);
        expect(agentMaker.data).toBeDefined();
    });
});
