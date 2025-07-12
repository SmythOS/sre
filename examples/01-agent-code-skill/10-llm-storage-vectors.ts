import { Agent, TLLMEvent } from '@smythos/sdk';

async function main() {
    const agent = new Agent({ name: 'Evaluator', model: 'gpt-4o' });

    agent.addSkill({
        name: 'TestSkill',
        description: 'Use this a test skill to demonstrate agent SDK capabilities',
        process: async ({ userName, userNumber }) => {
            const secret = `${userNumber * 10}_${userName.substring(0, 3)}`;

            const openai = agent.llm.OpenRouter('gpt-4o-mini');
            const result = openai.prompt('Write a haiku about sakura trees');
            console.log(result);

            //we can also use .stream() to get a stream of results
            const emitter = await openai.prompt('Write a haiku about sakura trees').stream();
            emitter.on(TLLMEvent.Content, (data) => {
                console.log(data);
            });

            //writing data using storage with agent access level
            const storage = agent.storage.LocalStorage();
            const uri = await storage.write('secret.txt', secret);

            //writing data using storage with team access level
            const teamStorage = agent.team.storage.LocalStorage();
            const teamUri = await teamStorage.write('secret.txt', secret);

            console.log(uri);

            console.log('calculating secret...', secret);
            return { secret };
        },
    });

    const result = await agent.prompt('What is my secret number ? My name is John and my number is 999555');
    console.log(result);
}

main();
