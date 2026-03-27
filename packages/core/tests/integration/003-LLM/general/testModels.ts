const testModels = [
    { provider: 'OpenAI', id: 'gpt-4o-mini', features: ['multiple-tools'] },
    { provider: 'Anthropic', id: 'claude-3.5-haiku' },
    { provider: 'GoogleAI', id: 'gemini-1.5-flash' },
    // * LM Studio must be running with the following local model installed for these tests to pass.
    // {
    //     provider: 'OpenAI',
    //     id: {
    //         provider: 'OpenAI',
    //         modelId: 'qwen2.5-7b-instruct-1m',
    //         baseURL: 'http://localhost:1234/v1',
    //         tokens: 8192,
    //         completionTokens: 4096,
    //         enabled: true,
    //         features: ['text', 'tools'],
    //         credentials: 'vault',
    //         isCustomLLM: true,
    //     },
    // },
    // * Ollama must be running with the following local model installed for these tests to pass.
    // {
    //     provider: 'Ollama',
    //     id: {
    //         provider: 'Ollama',
    //         modelId: 'llama3.1:latest',
    //         baseURL: 'http://127.0.0.1:11434/',
    //         tokens: 8192,
    //         completionTokens: 4096,
    //         enabled: true,
    //         features: ['text', 'tools'],
    //         credentials: 'vault',
    //         isCustomLLM: true,
    //     },
    // },
    //{ provider: 'Groq', id: 'gemma2-9b-it' },
    //{ provider: 'TogetherAI', id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' },
    // { provider: 'TogetherAI', id: 'meta-llama/Meta-Llama-3-8B-Instruct-Lite' },
    // { provider: 'xAI', id: 'grok-beta' },
];

export default testModels;
