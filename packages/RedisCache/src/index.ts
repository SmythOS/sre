//IMPORTANT NOTE : Your API keys are configured in one of the following files :
//  .smyth/.sre/vault.json
//  ~/.smyth/.sre/vault.json

//Edit the vault.json file to update your API keys

import { Agent, TLLMEvent } from '@smythos/sdk';
import chalk from 'chalk';

//We create the agent instance without any skills, using just an LLM with a behavior
const agent = new Agent({
    //the name of the agent, this is how the agent will identify itself
    name: 'Storyteller',

    //here we are using a builtin model
    //note that we are not passing an apiKey because we will rely on smyth vault for the model credentials
    model: 'gpt-4o-mini',

    //the behavior of the agent, this describes the personnality and behavior of the agent
    behavior: 'You are a storyteller that can write fantastic stories.',
});

agent.addSkill({
    name: 'greeting',
    description: 'Say hello to the user',
    process: async () => {
        return `Hello World!`;
    },
});

//Below you can find other ways to interact with the agent

async function main() {
    //1. call a skill directly

    console.log(`${chalk.blue('1. Calling skill directly')}`);

    const result1 = await agent.call('greeting');
    console.log(result1);

    console.log(`${chalk.white('--------------------------------')}`);

    //2. prompt
    console.log(`${chalk.blue('2. Prompting the agent')}`);
    console.log(`${chalk.gray('Writing story, please wait...')}`);

    const result2 = await agent.prompt('Write a short story about a cat.');

    console.log(result2);

    console.log(`${chalk.white('--------------------------------')}`);

    //3. prompt and stream response
    console.log(`${chalk.blue('3. Prompting the agent and streaming response')}`);

    const stream = await agent.prompt('Write a short story about a cat.').stream();
    stream.on(TLLMEvent.Content, (content) => {
        process.stdout.write(content);
    });

    //This promise will resolve once the stream response above is complete
    const waitStreamPromise = new Promise((resolve, reject) => {
        stream.on(TLLMEvent.End, () => {
            resolve(true);
        });
    });

    await waitStreamPromise;

    console.log(`${chalk.white('--------------------------------')}`);

    //4. chat
    console.log(`${chalk.blue('4. Chatting with the agent')}`);
    const chat = agent.chat({
        id: 'my-chat-session-001',
        persist: false, //<=== we don't want to persist the chat session in local storage, it will be lost when the program ends
    });

    console.log(`${chalk.green('4.1. Prompting the chat')}`);
    console.log(`${chalk.gray('Writing story, please wait...')}`);
    const result4 = await chat.prompt('Write a short story about a cat called "Whiskers".');

    console.log(result4);

    console.log(`${chalk.white('--------------------------------')}`);

    console.log(`${chalk.green('4.2. Prompting the chat and streaming response')}`);
    const stream2 = await chat.prompt('Rewrite the story and introduce a new character, a dog called "Rex".').stream();

    stream2.on(TLLMEvent.Content, (content) => {
        process.stdout.write(content);
    });

    console.log(`${chalk.white('--------------------------------')}`);
    console.log(`${chalk.green('Done')}`);
}

main();
