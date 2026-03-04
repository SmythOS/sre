import { Agent, Model } from '@smythos/sdk';

async function main() {
    const agent = new Agent({
        name: 'Ollama Tool Agent',
        behavior: 'Use tools as necessary to answer accurately.',
        //Using Ollama provider (Ollama app)
        model: Model.Ollama('qwen3:0.6b-q4_K_M', { baseURL: 'http://localhost:11434/api/' }),
        //Using OpenAI provider (e.g LM Studio)
        // model: Model.OpenAI('openai/gpt-oss', { baseURL: 'http://127.0.0.1:1234/v1' }),
    });

    agent.addSkill({
        name: 'getTime',
        description: 'Get the current time in ISO format',
        process: async () => new Date().toISOString(),
    });

    const result = await agent.prompt('What time is it right now?');
    console.log('Answer with tool:', result);
}
main().catch(console.error);
