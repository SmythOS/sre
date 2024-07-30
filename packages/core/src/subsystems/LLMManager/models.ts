export default {
    echo: {
        llm: 'Echo',
        alias: 'Echo',
    },
    Echo: {
        llm: 'Echo',
        tokens: 128000,
        completionTokens: 128000,
        enabled: true,
        components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'VisionLLM', 'AgentPlugin', 'Chatbot'],
    },

    // GPT-4o
    'gpt-4o': {
        llm: 'OpenAI',
        alias: 'gpt-4o-2024-05-13',
        components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'VisionLLM', 'AgentPlugin', 'Chatbot'],
        tags: ['new'],
    },
    'gpt-4o-2024-05-13': {
        llm: 'OpenAI',
        tokens: 2048,
        completionTokens: 2048,
        enabled: true,
        keyOptions: { tokens: 128000, completionTokens: 4096 },
    },
    // GPT-4-turbo
    'gpt-4-turbo-latest': {
        llm: 'OpenAI',
        alias: 'gpt-4-turbo-2024-04-09',
        components: ['PromptGenerator', 'LLMAssistant', 'Classifier'],
    },
    'gpt-4-turbo': {
        llm: 'OpenAI',
        alias: 'gpt-4-turbo-2024-04-09',
        components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'GPTPlugin', 'AgentPlugin', 'Chatbot'],
        tags: ['stable'],
    },
    'gpt-4-turbo-2024-04-09': {
        llm: 'OpenAI',
        tokens: 1024,
        completionTokens: 1024,
        enabled: true,
        keyOptions: { tokens: 128000, completionTokens: 4096 },
    },
    // GPT-4
    'gpt-4-latest': {
        llm: 'OpenAI',
        alias: 'gpt-4-0613',
        enabled: true,
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'gpt-4': {
        llm: 'OpenAI',
        tokens: 1024,
        completionTokens: 1024,
        enabled: true,
        keyOptions: { tokens: 8192, completionTokens: 8192 },
        components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'GPTPlugin', 'AgentPlugin', 'Chatbot'],
        tags: ['stable'],
    },
    'gpt-4-0613': {
        llm: 'OpenAI',
        tokens: 1024,
        completionTokens: 1024,
        enabled: true,
        hidden: true,
        keyOptions: { tokens: 8192, completionTokens: 8192 },
    },
    'gpt-4-vision-preview': {
        llm: 'OpenAI',
        tokens: 1024,
        completionTokens: 1024,
        enabled: true,
        keyOptions: { tokens: 128000, completionTokens: 4096 },
        components: ['VisionLLM'],
    },
    'gpt-4-1106-vision-preview': {
        llm: 'OpenAI',
        tokens: 1024,
        completionTokens: 1024,
        enabled: true,
        keyOptions: { tokens: 128000, completionTokens: 4096 },
    },

    // GPT-3.5
    'gpt-3.5-turbo-latest': {
        llm: 'OpenAI',
        alias: 'gpt-3.5-turbo-0125',
        components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'GPTPlugin', 'AgentPlugin', 'Chatbot'],
    },
    'gpt-3.5-turbo': {
        llm: 'OpenAI',
        alias: 'gpt-3.5-turbo-0125',
        components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'GPTPlugin', 'AgentPlugin', 'Chatbot'],
        tags: ['stable'],
    },
    'gpt-3.5-turbo-0125': {
        llm: 'OpenAI',
        tokens: 2048,
        completionTokens: 2048,
        enabled: true,
        keyOptions: { tokens: 16385, completionTokens: 4096 },
    },
    'gpt-3.5-turbo-1106': {
        llm: 'OpenAI',
        tokens: 2048,
        completionTokens: 2048,
        enabled: true,
        keyOptions: { tokens: 16384, completionTokens: 4096 },
        //components: ['PromptGenerator', 'LLMAssistant'],
    },

    'gpt-3.5-turbo-16k': {
        llm: 'OpenAI',
        alias: 'gpt-3.5-turbo-0125',
        //components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['legacy'],
    },
    // legacy model to continue support for Agent Plugins
    'gpt-3.5-turbo-0613': {
        llm: 'OpenAI',
        alias: 'gpt-3.5-turbo-0125',
        //components: ['GPTPlugin', 'AgentPlugin'],
        tags: ['deprecated'],
    },

    // AnthropicAI
    'claude-3-opus': {
        llm: 'AnthropicAI',
        alias: 'claude-3-opus-20240229',
        components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'VisionLLM', 'AgentPlugin', 'Chatbot'],
    },
    'claude-3.5-sonnet': {
        llm: 'AnthropicAI',
        alias: 'claude-3-5-sonnet-20240620',
        components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'VisionLLM', 'AgentPlugin', 'Chatbot'],
        tags: ['new'],
    },
    'claude-3-sonnet': {
        llm: 'AnthropicAI',
        alias: 'claude-3-sonnet-20240229',
        components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'VisionLLM', 'AgentPlugin', 'Chatbot'],
    },
    'claude-3-haiku': {
        llm: 'AnthropicAI',
        alias: 'claude-3-haiku-20240307',
        components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'VisionLLM', 'AgentPlugin', 'Chatbot'],
    },
    'claude-3-opus-20240229': {
        llm: 'AnthropicAI',
        tokens: 2048,
        completionTokens: 2048,
        enabled: false,
        keyOptions: { tokens: 200000, completionTokens: 4096, enabled: true },
    },
    'claude-3-5-sonnet-20240620': {
        llm: 'AnthropicAI',
        tokens: 2048,
        completionTokens: 2048,
        enabled: false,
        keyOptions: { tokens: 200000, completionTokens: 4096, enabled: true },
    },
    'claude-3-sonnet-20240229': {
        llm: 'AnthropicAI',
        tokens: 2048,
        completionTokens: 2048,
        enabled: false,
        keyOptions: { tokens: 200000, completionTokens: 4096, enabled: true },
    },
    'claude-3-haiku-20240307': {
        llm: 'AnthropicAI',
        tokens: 2048,
        completionTokens: 2048,
        enabled: false,
        keyOptions: { tokens: 200000, completionTokens: 4096, enabled: true },
    },
    'claude-2.1': {
        llm: 'AnthropicAI',
        tokens: 1024,
        completionTokens: 1024,
        enabled: false,
        keyOptions: { tokens: 200000, completionTokens: 4096, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant', 'Classifier'],
        tags: ['legacy'],
    },
    'claude-instant-1.2': {
        llm: 'AnthropicAI',
        tokens: 1024,
        completionTokens: 1024,
        enabled: false,
        keyOptions: { tokens: 100000, completionTokens: 4096, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant', 'Classifier'],
        tags: ['legacy'],
    },

    /*** Models from Google AI ***/

    // Gemini 1.5 pro
    'gemini-1.5-pro-latest': {
        llm: 'GoogleAI',
        tokens: 2048,
        completionTokens: 2048,
        enabled: false,
        keyOptions: { tokens: 1048576, completionTokens: 8192, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM'],
        tags: ['new'],
    },
    'gemini-1.5-pro-latest-stable': {
        llm: 'GoogleAI',
        alias: 'gemini-1.5-pro',
        components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM'],
        tags: ['new'],
    },
    'gemini-1.5-pro-stable': {
        llm: 'GoogleAI',
        alias: 'gemini-1.5-pro-001',
        components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM'],
        tags: ['new'],
    },
    'gemini-1.5-pro': {
        llm: 'GoogleAI',
        tokens: 2048,
        completionTokens: 2048,
        enabled: false,
        keyOptions: { tokens: 1048576, completionTokens: 8192, enabled: true },
    },
    'gemini-1.5-pro-001': {
        llm: 'GoogleAI',
        tokens: 2048,
        completionTokens: 2048,
        enabled: false,
        keyOptions: { tokens: 1048576, completionTokens: 8192, enabled: true },
    },

    // Gemini 1.5 flash
    'gemini-1.5-flash-latest': {
        llm: 'GoogleAI',
        tokens: 2048,
        completionTokens: 2048,
        enabled: false,
        keyOptions: { tokens: 1048576, completionTokens: 8192, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM'],
        tags: ['new'],
    },
    'gemini-1.5-flash-latest-stable': {
        llm: 'GoogleAI',
        alias: 'gemini-1.5-flash',
        components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM'],
        tags: ['new'],
    },
    'gemini-1.5-flash-stable': {
        llm: 'GoogleAI',
        alias: 'gemini-1.5-flash-001',
        components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM'],
        tags: ['new'],
    },
    'gemini-1.5-flash': {
        llm: 'GoogleAI',
        tokens: 2048,
        completionTokens: 2048,
        enabled: false,
        keyOptions: { tokens: 1048576, completionTokens: 8192, enabled: true },
    },
    'gemini-1.5-flash-001': {
        llm: 'GoogleAI',
        tokens: 2048,
        completionTokens: 2048,
        enabled: false,
        keyOptions: { tokens: 1048576, completionTokens: 8192, enabled: true },
    },

    // Gemini 1.0 pro
    'gemini-1.0-pro-latest': {
        llm: 'GoogleAI',
        tokens: 2048,
        completionTokens: 2048,
        enabled: false,
        keyOptions: { tokens: 30720, completionTokens: 2048, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'gemini-1.0-pro-latest-stable': {
        llm: 'GoogleAI',
        alias: 'gemini-1.0-pro',
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'gemini-1.0-pro-stable': {
        llm: 'GoogleAI',
        alias: 'gemini-1.0-pro-001',
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'gemini-1.0-pro': {
        llm: 'GoogleAI',
        tokens: 2048,
        completionTokens: 2048,
        enabled: false,
        keyOptions: { tokens: 30720, completionTokens: 2048, enabled: true },
    },
    'gemini-1.0-pro-001': {
        llm: 'GoogleAI',
        tokens: 2048,
        completionTokens: 2048,
        enabled: false,
        keyOptions: { tokens: 30720, completionTokens: 2048, enabled: true },
    },
    'gemini-pro-vision': {
        llm: 'GoogleAI',
        tokens: 2048,
        completionTokens: 2048,
        enabled: false,
        keyOptions: { tokens: 12288, completionTokens: 4096, enabled: true },
        components: ['VisionLLM'],
    },

    /* Groq */
    'groq-llama3-8b': {
        llm: 'Groq',
        alias: 'llama3-8b-8192',
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'llama3-8b-8192': {
        llm: 'Groq',
        tokens: 1024,
        completionTokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
    },
    'groq-llama3-70b': {
        llm: 'Groq',
        alias: 'llama3-70b-8192',
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'llama3-70b-8192': {
        llm: 'Groq',
        tokens: 1024,
        completionTokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
    },
    'groq-llama2-70b': {
        llm: 'Groq',
        alias: 'llama2-70b-4096',
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'llama2-70b-4096': {
        llm: 'Groq',
        tokens: 1024,
        completionTokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, completionTokens: 4096, enabled: true },
    },
    'groq-mixtral-8x7b': {
        llm: 'Groq',
        alias: 'mixtral-8x7b-32768',
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'mixtral-8x7b-32768': {
        llm: 'Groq',
        tokens: 1024,
        completionTokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, completionTokens: 32768, enabled: true },
    },
    'groq-gemma-7b': {
        llm: 'Groq',
        alias: 'gemma-7b-it',
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'gemma-7b-it': {
        llm: 'Groq',
        tokens: 1024,
        completionTokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
    },

    /* Together AI */
    'zero-one-ai/Yi-34B-Chat': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['LLMAssistant'], // * Excluded from 'PromptGenerator' (has "```json...```" with JSON response)
    },
    'Austism/chronos-hermes-13b': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 2048, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },

    // Meta
    'togethercomputer/CodeLlama-13b-Instruct': {
        // ! DEPRECATED: will be removed (replace with codellama/CodeLlama-13b-Instruct-hf)
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, enabled: true },
    },
    'codellama/CodeLlama-13b-Instruct-hf': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'togethercomputer/CodeLlama-34b-Instruct': {
        // ! DEPRECATED: will be removed (replaced with codellama/CodeLlama-34b-Instruct-hf)
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, enabled: true },
    },
    'codellama/CodeLlama-34b-Instruct-hf': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'codellama/CodeLlama-70b-Instruct-hf': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'togethercomputer/CodeLlama-7b-Instruct': {
        // ! DEPRECATED: will be removed (replaced with codellama/CodeLlama-7b-Instruct-hf)
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, enabled: true },
    },
    'codellama/CodeLlama-7b-Instruct-hf': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 16384, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'togethercomputer/llama-2-70b-chat': {
        // ! DEPRECATED: will be removed (replaced with meta-llama/Llama-2-70b-chat-hf)
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
    },
    'meta-llama/Llama-2-70b-chat-hf': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'togethercomputer/llama-2-13b-chat': {
        // ! DEPRECATED: will be removed (replaced with meta-llama/Llama-2-13b-chat-hf)
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
    },
    'meta-llama/Llama-2-13b-chat-hf': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['LLMAssistant'], // * Excluded from 'PromptGenerator' (has introductory text with JSON response)
    },
    'togethercomputer/llama-2-7b-chat': {
        // ! DEPRECATED: will be removed (replaced with meta-llama/Llama-2-7b-chat-hf)
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
    },
    'meta-llama/Llama-2-7b-chat-hf': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['LLMAssistant'], // * Excluded from 'PromptGenerator' (has introductory text with JSON response)
    },
    'meta-llama/Llama-3-8b-chat-hf': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'meta-llama/Llama-3-70b-chat-hf': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },

    'DiscoResearch/DiscoLM-mixtral-8x7b-v2': {
        // ! DEPRECATED: will be removed (404 - not found)
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
    },
    'togethercomputer/falcon-40b-instruct': {
        // ! DEPRECATED: will be removed (404 - not found)
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 2048, enabled: true },
    },
    'togethercomputer/falcon-7b-instruct': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 2048, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'togethercomputer/GPT-NeoXT-Chat-Base-20B': {
        // ! DEPRECATED: will be removed (404 - not found)
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 2048, enabled: true },
    },
    'togethercomputer/Llama-2-7B-32K-Instruct': {
        // ! DEPRECATED: will be removed
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
    },

    // mistralai
    'mistralai/Mistral-7B-Instruct-v0.1': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'mistralai/Mistral-7B-Instruct-v0.2': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'mistralai/Mistral-7B-Instruct-v0.3': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant', 'Classifier'],
        tags: ['new'],
    },
    'mistralai/Mixtral-8x7B-Instruct-v0.1': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant', 'Classifier'],
    },
    'mistralai/Mixtral-8x22B-Instruct-v0.1': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 65536, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },

    'Gryphe/MythoMax-L2-13b': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },

    // NousResearch
    'NousResearch/Nous-Hermes-Llama2-70b': {
        // ! DEPRECATED: will be removed (404 - not found)
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
    },
    'NousResearch/Nous-Capybara-7B-V1p9': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'NousResearch/Nous-Hermes-2-Mistral-7B-DPO': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'NousResearch/Nous-Hermes-2-Mixtral-8x7B-SFT': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'NousResearch/Nous-Hermes-2-Yi-34B': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'NousResearch/Nous-Hermes-llama-2-7b': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'NousResearch/Nous-Hermes-Llama2-13b': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },

    // OpenChat
    'openchat/openchat-3.5-1210': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },

    // Teknium
    'teknium/OpenHermes-2-Mistral-7B': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'teknium/OpenHermes-2p5-Mistral-7B': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },

    'garage-bAInd/Platypus2-70B-instruct': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'togethercomputer/Pythia-Chat-Base-7B-v0.16': {
        // ! DEPRECATED: will be removed (404 - not found)
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 2048, enabled: true },
    },
    'togethercomputer/Qwen-7B-Chat': {
        // ! DEPRECATED: will be removed (404 - not found)
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, enabled: true },
    },
    'togethercomputer/RedPajama-INCITE-Chat-3B-v1': {
        // ! DEPRECATED: will be removed (Weird response)
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 2048, enabled: true },
    },
    'togethercomputer/RedPajama-INCITE-7B-Chat': {
        // ! DEPRECATED: will be removed (Weird response)
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 2048, enabled: true },
    },
    'upstage/SOLAR-0-70b-16bit': {
        // ! DEPRECATED: will be removed (404 - not found) (replaced with upstage/SOLAR-10.7B-Instruct-v1.0)
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
    },
    'upstage/SOLAR-10.7B-Instruct-v1.0': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'togethercomputer/StripedHyena-Nous-7B': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'lmsys/vicuna-7b-v1.5': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'lmsys/vicuna-13b-v1.5': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'lmsys/vicuna-13b-v1.5-16k': {
        // ! DEPRECATED: will be removed (not exists in models page)
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 16384, enabled: true },
    },

    // Allen AI
    // ! Response it is not JSON and have unnecessary information
    /* 'allenai/OLMo-7B-Instruct': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 2048, enabled: true },
    }, */
    'allenai/OLMo-7B-Twin-2T': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 2048, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'allenai/OLMo-7B': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 2048, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },

    // Qwen
    'Qwen/Qwen1.5-0.5B-Chat': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['LLMAssistant'], // * Excluded from 'PromptGenerator' (has introductory text with JSON response)
        tags: ['new'],
    },
    'Qwen/Qwen1.5-1.8B-Chat': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'Qwen/Qwen1.5-4B-Chat': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'Qwen/Qwen1.5-7B-Chat': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'Qwen/Qwen1.5-14B-Chat': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'Qwen/Qwen1.5-32B-Chat': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'Qwen/Qwen1.5-72B-Chat': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'Qwen/Qwen1.5-110B-Chat': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },

    // DeepSeek
    'deepseek-ai/deepseek-coder-33b-instruct': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 16384, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'deepseek-ai/deepseek-llm-67b-chat': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },

    // Google
    'google/gemma-2b-it': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'google/gemma-7b-it': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },

    // Undi95
    'Undi95/ReMM-SLERP-L2-13B': {
        // ! DEPRECATED: will be removed (always have empty response)
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
    },
    'Undi95/Toppy-M-7B': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },

    // Others
    'cognitivecomputations/dolphin-2.5-mixtral-8x7b': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'databricks/dbrx-instruct': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'Open-Orca/Mistral-7B-OpenOrca': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 8192, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'snorkelai/Snorkel-Mistral-PairRM-DPO': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 32768, enabled: true },
        components: ['LLMAssistant'], // * Excluded from 'PromptGenerator' (has some other text)
        tags: ['new'],
    },
    'Snowflake/snowflake-arctic-instruct': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
        tags: ['new'],
    },
    'togethercomputer/alpaca-7b': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 2048, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
    'WizardLM/WizardLM-13B-V1.2': {
        llm: 'togetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 4096, enabled: true },
        components: ['PromptGenerator', 'LLMAssistant'],
    },
};
