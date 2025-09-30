import { LLM } from '@smythos/sdk';

async function testLLM() {
    //Using Ollama provider (Ollama app)
    const llm = LLM.Ollama('qwen3:0.6b-q4_K_M', {
        baseURL: 'http://localhost:11434/api/',
        maxTokens: 512,
        temperature: 0.2,
    });
    //Using OpenAI provider (e.g LM Studio)
    // const llm = LLM.OpenAI('openai/gpt-oss', {
    //   baseURL: 'http://127.0.0.1:1234/v1',
    //   maxTokens: 512,
    //   temperature: 0.2
    // });

    const result = await llm.prompt('Summarize the benefits of local LLMs in 3 bullet points.');
    console.log(result);
}
testLLM().catch(console.error);
