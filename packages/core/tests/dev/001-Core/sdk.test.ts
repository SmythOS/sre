// prettier-ignore-file
import { SmythRuntime, SRE } from '@sre/Core/SmythRuntime.class';
import { LLM } from '@sre/sdk/LLM.class';
import { Agent, LLMProviderMap } from '@sre/sdk/sdk.index';
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
        //initialize the LLM
        const llm = new LLM('OpenAI', { model: 'gpt-4o' });

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

        const result = await agent.prompt('Hello, what is the capital of France');
        console.log(result);
    });

    it('SDK procedural', async () => {
        const agent: any = new Agent({ name: 'Evaluator', model: 'gpt-4o' });

        agent.addSkill({
            behavior: 'Use this tool to evaluate an answer',
            process: async (input: any) => {
                const openai = agent.llm.openai('gpt-4o');
                const claude = agent.llm.anthropic('sonnet-4');
                const gemini = agent.llm.gemini('flash-2.5');
                const deepseek = agent.llm.deepseek('coder');

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

        const result = await agent.run({ question: 'What is the capital of France?' });
        console.log(result);

        console.log(agent.data);
        expect(agent.data).toBeDefined();
    });
});
