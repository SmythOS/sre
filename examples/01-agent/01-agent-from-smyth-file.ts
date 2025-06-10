import { Agent, Model } from '@smythos/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function main() {
    const agentPath = path.resolve(__dirname, '../agents-data', 'crypto-info-agent.smyth');

    console.log('Importing agent from', agentPath);

    const agent = Agent.import(agentPath, {
        model: Model.OpenAI('gpt-4o'),
    });

    const result = await agent.prompt('What are the current prices of Bitcoin and Ethereum ?');

    console.log(result);

    // const agent = new Agent({ name: 'Evaluator', model: 'gpt-4o' });

    // agent.addSkill({
    //     name: 'GetSecret',
    //     description: 'Use this tool to provide a secret based on user info',
    //     process: async ({ userName, userNumber }) => {
    //         const secret = `${userNumber * 10}_${userName.substring(0, 3)}`;

    //         const openai = agent.llm.OpenAI('gpt-4o-mini');
    //         console.log(openai);

    //         console.log('calculating secret...', secret);
    //         return { secret };
    //     },
    // });

    // const result = await agent.prompt('What is my secret number ? My name is John and my number is 001425');
    // console.log(result);
}

main();
