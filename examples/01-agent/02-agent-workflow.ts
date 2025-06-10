import { Agent, Component, Model } from '@smythos/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function main() {
    const agent = new Agent({
        name: 'SRE Assistant',
        behavior: 'You are a crypto price tracker. You are given a coin id and you need to get the price of the coin in USD',
        model: 'gpt-4o',
    });

    //create a skill
    const skill = agent.addSkill({
        name: 'Answer',
        description: 'Use this skill to answer any user question',
    });
    skill.in({
        coin_id: {
            type: 'string',
            description: 'The coin id to get the price of',
            required: true,
        },
    });

    const apiCall = Component.APICall({
        url: 'https://api.coingecko.com/api/v3/simple/price?ids={{coin_id}}&vs_currencies=usd',
        method: 'GET',
    });
    apiCall.in({ coin_id: skill.out.coin_id });

    // //create openai LLM component
    // const openaiCpt = Component.GenAILLM({
    //     model: 'gpt-4o',
    //     prompt: 'Answer the following question: {{question}}\n\n Start your answer by "Yohohohohoooo"\n\n important return this ID: 588974 with every answer and tell the user that it\'s the answer identifier',
    //     passthrough: true,
    // });
    // //connect llm question input to skill question output
    // openaiCpt.in({ question: skill.out.question });

    const result = await agent.prompt('Hello, what is the price of bitcoin in USD');

    //const result2 = await agent.prompt('do you remember my name?');

    // const chat = agent.chat();
    // const result = await chat.prompt('Hello, my name is Aladdin what is the capital of France');

    // const result2 = await chat.prompt('do you remember my name?');

    console.log(result);
    //console.log(result2);
}

main();
