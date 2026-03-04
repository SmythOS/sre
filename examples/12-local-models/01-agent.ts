import { Agent, Model } from '@smythos/sdk';

async function main() {
    const agent = new Agent({
        name: 'Ollama Agent',
        behavior: 'You are a helpful assistant.',
        //Using Ollama provider (Ollama app)
        model: Model.Ollama('qwen3:0.6b-q4_K_M', {
            baseURL: 'http://localhost:11434/api/',
            inputTokens: 4096,
            outputTokens: 1024,
            temperature: 0.7,
        }),

        //Using OpenAI provider (e.g LM Studio)
        // model: Model.OpenAI('openai/gpt-oss', {
        //   baseURL: 'http://127.0.0.1:1234/v1',
        //   inputTokens: 4096,
        //   outputTokens: 1024,
        //   temperature: 0.7
        // }),
    });

    const result = await agent.prompt('What is the capital of France?');
    console.log('Answer:', result);
}
main().catch(console.error);
