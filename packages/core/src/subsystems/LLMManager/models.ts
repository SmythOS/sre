/******************************************************
 * ! DO NOT MODIFY THIS FILE INDEPENDENTLY
 * ! TO ENSURE CONSISTENCY, THIS FILE IS SYNCED WITH
 * ! THE APP AND SRE VERSIONS
 ******************************************************/

/**
 * * DEPRECATION NOTICE:
 * The following fields are being deprecated in favor of more semantic alternatives:
 *
 * - 'llm' -> 'provider'        : Use 'provider' to specify the LLM service provider
 * - 'alias' -> 'modelId'       : Use 'modelId' to specify the unique model identifier
 * - 'components' -> 'features' : Use 'features' to specify model capabilities
 *
 * * We will remove the 'legacy' and 'deprecated' models soon, for now we just hide them.
 */

// * features we support ['text', 'image', 'audio', 'video', 'document', 'tools', 'image-generation', 'text-to-image', 'image-to-image', 'image-inpainting', 'image-outpainting']

export const models = {
  Echo: {
      llm: 'Echo',
  },

  // #region [SmythOS Models] ==============================================================

  // #region OpenAI ==========================
  // keep the gpt-4o-mini as default model for now
  'smythos/gpt-4o-mini': {
      llm: 'OpenAI',

      label: 'GPT 4o Mini',
      modelId: 'gpt-4o-mini-2024-07-18',
      provider: 'OpenAI',
      features: ['text', 'image', 'tools', 'search'],
      tags: ['SmythOS'],
      tokens: 128_000,
      completionTokens: 16_383,
      searchContextTokens: 128_000,
      enabled: true,

      credentials: 'internal',
  },
  'smythos/gpt-4.1-nano': {
      llm: 'OpenAI',

      label: 'GPT 4.1 Nano',
      modelId: 'gpt-4.1-nano',
      provider: 'OpenAI',
      features: ['text', 'tools', 'image'],
      tags: ['New', 'SmythOS'],
      tokens: 1_047_576,
      completionTokens: 32_768,
      enabled: true,

      credentials: 'internal',
  },
  'smythos/gpt-4.1-mini': {
      llm: 'OpenAI',

      label: 'GPT 4.1 Mini',
      modelId: 'gpt-4.1-mini',
      provider: 'OpenAI',
      features: ['text', 'tools', 'image', 'search'],
      tags: ['New', 'SmythOS'],
      tokens: 1_047_576,
      completionTokens: 32_768,
      searchContextTokens: 128_000,
      enabled: true,
  },
  'smythos/gpt-4.1': {
      llm: 'OpenAI',

      label: 'GPT 4.1',
      modelId: 'gpt-4.1',
      provider: 'OpenAI',
      features: ['text', 'tools', 'image', 'search'],
      tags: ['New', 'SmythOS'],
      tokens: 1_047_576,
      completionTokens: 32_768,
      searchContextTokens: 128_000,
      enabled: true,

      credentials: 'internal',
  },
  'smythos/gpt-4o': {
      llm: 'OpenAI',

      label: 'GPT 4o',
      modelId: 'gpt-4o-2024-08-06',
      provider: 'OpenAI',
      features: ['text', 'image', 'tools', 'search'],
      tags: ['SmythOS'],
      tokens: 128_000,
      completionTokens: 16_384,
      searchContextTokens: 128_000,
      enabled: true,

      credentials: 'internal',
  },
  'smythos/o4-mini': {
      llm: 'OpenAI',

      label: 'GPT o4 mini',
      modelId: 'o4-mini-2025-04-16',
      provider: 'OpenAI',
      features: ['text', 'reasoning'],
      tags: ['New', 'SmythOS'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 100_000, enabled: true },
  },
  'smythos/o3': {
      llm: 'OpenAI',

      label: 'GPT o3',
      modelId: 'o3-2025-04-16',
      provider: 'OpenAI',
      features: ['text', 'reasoning'],
      tags: ['SmythOS'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 100_000, enabled: true },
  },
  'smythos/o1': {
      llm: 'OpenAI',

      label: 'GPT o1',
      modelId: 'o1-2024-12-17',
      provider: 'OpenAI',
      features: ['text', 'reasoning'],
      tags: ['SmythOS'],
      tokens: 200_000,
      completionTokens: 100_000,
      enabled: true,

      credentials: 'internal',
  },
  'smythos/o1-mini': {
      llm: 'OpenAI',

      label: 'GPT o1 mini',
      modelId: 'o1-mini-2024-09-12',
      provider: 'OpenAI',
      features: ['text'],
      tags: ['SmythOS'],
      tokens: 128_000,
      completionTokens: 65_536,
      enabled: true,

      credentials: 'internal',
  },

  // #endregion OpenAI ==========================

  // #region Anthropic ==========================
  'smythos/claude-4-opus': {
      label: 'Claude 4 Opus',
      modelId: 'claude-opus-4-20250514',
      provider: 'Anthropic',
      features: ['text', 'image', 'tools', 'reasoning'],
      tags: ['New', 'SmythOS'],
      tokens: 200000,
      completionTokens: 32000,
      maxReasoningTokens: 32000,
      enabled: true,

      credentials: 'internal',
  },
  'smythos/claude-4-sonnet': {
      label: 'Claude 4 Sonnet',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'Anthropic',
      features: ['text', 'image', 'tools', 'reasoning'],
      tags: ['New', 'SmythOS'],
      tokens: 200000,
      completionTokens: 64000,
      maxReasoningTokens: 32000,
      enabled: true,

      credentials: 'internal',
  },

  'smythos/claude-3.7-sonnet': {
      llm: 'Anthropic',

      label: 'Claude 3.7 Sonnet',
      modelId: 'claude-3-7-sonnet-20250219',
      provider: 'Anthropic',
      features: ['text', 'image', 'tools', 'reasoning'],
      tags: ['SmythOS'],
      tokens: 200_000,
      completionTokens: 8_192,
      maxReasoningTokens: 16384,
      enabled: true,

      credentials: 'internal',
  },
  'smythos/claude-3.7-sonnet-thinking': {
      llm: 'Anthropic',

      label: 'Claude 3.7 Sonnet Thinking',
      modelId: 'claude-3-7-sonnet-20250219',
      provider: 'Anthropic',
      features: ['text', 'tools', 'image', 'reasoning'],
      tags: ['SmythOS'],
      tokens: 200_000,
      completionTokens: 16_384,
      maxReasoningTokens: 16384,
      enabled: true,
      hidden: true,

      credentials: 'internal',
  },
  'smythos/claude-3.5-haiku': {
      llm: 'Anthropic',

      label: 'Claude 3.5 Haiku',
      modelId: 'claude-3-5-haiku-latest',
      provider: 'Anthropic',
      features: ['text', 'tools'],
      tags: ['SmythOS'],
      tokens: 200_000,
      completionTokens: 8_192,
      enabled: true,

      credentials: 'internal',
  },

  // #endregion Anthropic ==========================

  // #region Google AI ==========================
  'smythos/gemini-2.5-flash': {
      llm: 'GoogleAI',

      label: 'Gemini 2.5 Flash Preview',
      modelId: 'gemini-2.5-flash-preview-04-17',
      provider: 'GoogleAI',
      features: ['text', 'image', 'audio', 'video', 'document'],
      tags: ['New', 'SmythOS'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 1_048_576, completionTokens: 65_536, enabled: true },

      credentials: 'vault',
  },
  'smythos/gemini-2.0-flash': {
      llm: 'GoogleAI',

      label: 'Gemini 2.0 Flash',
      modelId: 'gemini-2.0-flash',
      provider: 'GoogleAI',
      features: ['text', 'image', 'audio', 'video', 'document'],
      tags: ['SmythOS'],
      tokens: 1_048_576,
      completionTokens: 8_192,
      enabled: true,
      hidden: true,

      credentials: 'vault',
  },
  'smythos/gemini-2.5-pro': {
      llm: 'GoogleAI',

      label: 'Gemini 2.5 Pro Preview',
      modelId: 'gemini-2.5-pro-preview-03-25',
      provider: 'GoogleAI',
      features: ['text', 'image', 'audio', 'video', 'document'],
      tags: ['New', 'SmythOS'],
      tokens: 1_048_576,
      completionTokens: 65_536,
      enabled: true,

      credentials: 'vault',
  },
  'smythos/gemini-1.5-pro': {
      llm: 'GoogleAI',

      label: 'Gemini 1.5 Pro',
      modelId: 'gemini-1.5-pro',
      provider: 'GoogleAI',
      features: ['text', 'image', 'audio', 'video', 'document'],
      tags: ['SmythOS', 'deprecated'],
      tokens: 2_097_152,
      completionTokens: 8_192,
      enabled: true,
      hidden: true,

      credentials: 'vault',
  },
  // #endregion Google AI ==========================

  // #region Groq ==========================
  // ? We don't have the Groq API key, so we hide it for now.
  'smythos/groq-gemma2-9b': {
      llm: 'Groq',

      label: 'Google - Gemma 2 9B',
      modelId: 'gemma2-9b-it',
      provider: 'Groq',
      features: ['text'],
      tags: ['SmythOS'],
      tokens: 8_192,
      completionTokens: 8_192,
      enabled: false,
      hidden: true,

      credentials: 'vault',
  },

  'smythos/llama-3.3-70b': {
      llm: 'Groq',

      label: 'Meta - Llama 3.3 70B',
      modelId: 'llama-3.3-70b-versatile',
      provider: 'Groq',
      features: ['text'],
      tags: ['SmythOS'],
      tokens: 128_000,
      completionTokens: 32_768,
      enabled: false,
      hidden: true,

      credentials: 'vault',
  },

  // #endregion Groq ==========================

  // #region Perplexity ==========================
  'smythos/sonar': {
      llm: 'Perplexity',

      label: 'Sonar',
      modelId: 'sonar',
      provider: 'Perplexity',
      features: ['text'],
      tags: ['SmythOS'],
      tokens: 128_000,
      completionTokens: 8_192,
      enabled: true,

      baseURL: 'https://api.perplexity.ai/chat/completions',

      credentials: 'vault',
  },
  'smythos/sonar-deep-research': {
      llm: 'Perplexity',

      label: 'Sonar Deep Research',
      modelId: 'sonar-deep-research',
      provider: 'Perplexity',
      features: ['text'],
      tags: ['New', 'SmythOS'],
      tokens: 128_000,
      completionTokens: 8_192,
      enabled: true,

      baseURL: 'https://api.perplexity.ai/chat/completions',

      credentials: 'vault',
  },
  'smythos/sonar-reasoning-pro': {
      llm: 'Perplexity',

      label: 'Sonar Reasoning Pro',
      modelId: 'sonar-reasoning-pro',
      provider: 'Perplexity',
      features: ['text'],
      tags: ['SmythOS'],
      tokens: 128_000,
      completionTokens: 8_192,
      enabled: true,

      baseURL: 'https://api.perplexity.ai/chat/completions',

      credentials: 'vault',
  },
  'smythos/sonar-pro': {
      llm: 'Perplexity',

      label: 'Sonar Pro',
      modelId: 'sonar-pro',
      provider: 'Perplexity',
      features: ['text'],
      tags: ['SmythOS'],
      tokens: 200_000,
      completionTokens: 8_192,
      enabled: true,

      baseURL: 'https://api.perplexity.ai/chat/completions',

      credentials: 'vault',
  },
  // #endregion Perplexity ==========================

  // #endregion [SmythOS Models] ==============================================================

  // #region [User Models] ==============================================================

  // #region DeepSeek ==========================

  /******************************************************
   * NOTE: From Alexander: About the DeepSeek API implementation
   * We're not allowing our users to send their data to China
   * Instead we use Deepseek from Groq and Together.ai - companies in the West
   ******************************************************/

  'deepseek-v2.5': {
      llm: 'DeepSeek',

      label: 'DeepSeek Chat',
      modelId: 'deepseek-chat',
      provider: 'DeepSeek',
      features: ['text', 'image'],
      tags: ['Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 8192, enabled: true },

      baseURL: 'https://api.deepseek.com/beta',

      credentials: 'vault',
  },
  'deepseek-chat': {
      llm: 'DeepSeek',
      baseURL: 'https://api.deepseek.com/beta',
      tokens: 128000,
      completionTokens: 8192,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 8192 },

      credentials: 'vault',
  },

  // #endregion DeepSeek ==========================

  // #region OpenAI Models ==========================

  // keep the gpt-4o-mini as default model for now
  'gpt-4o-mini': {
      llm: 'OpenAI',
      alias: 'gpt-4o-mini-2024-07-18',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'VisionLLM', 'AgentPlugin', 'Chatbot', 'GPTPlugin', 'GenAILLM'],

      label: 'GPT 4o Mini',
      modelId: 'gpt-4o-mini-2024-07-18',
      provider: 'OpenAI',
      features: ['text', 'tools', 'image', 'search'],
      tags: ['Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: {
          tokens: 128_000,
          completionTokens: 16_383,
          searchContextTokens: 128_000,
          enabled: true,
      },

      credentials: 'vault',
  },

  // #region GPT 4.1
  'gpt-4.1-nano': {
      llm: 'OpenAI',

      label: 'GPT 4.1 Nano',
      modelId: 'gpt-4.1-nano',
      provider: 'OpenAI',
      features: ['text', 'tools', 'image'],
      tags: ['New', 'Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 1_047_576, completionTokens: 32_768, enabled: true },

      credentials: 'vault',
  },
  'gpt-4.1-mini': {
      llm: 'OpenAI',

      label: 'GPT 4.1 Mini',
      modelId: 'gpt-4.1-mini',
      provider: 'OpenAI',
      features: ['text', 'tools', 'image', 'search'],
      tags: ['New', 'Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: {
          tokens: 1_047_576,
          completionTokens: 32_768,
          searchContextTokens: 128_000,
          enabled: true,
      },

      credentials: 'vault',
  },
  'gpt-4.1': {
      llm: 'OpenAI',

      label: 'GPT 4.1',
      modelId: 'gpt-4.1',
      provider: 'OpenAI',
      features: ['text', 'tools', 'image', 'search'],
      tags: ['New', 'Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 1_047_576, completionTokens: 32_768, searchContextTokens: 128_000, enabled: true },

      credentials: 'vault',
  },
  // #endregion

  // #region GPT 4o
  'gpt-4o-mini-2024-07-18': {
      llm: 'OpenAI',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 128000, completionTokens: 16383, enabled: true },

      credentials: 'vault',
  },
  'gpt-4.5-preview': {
      llm: 'OpenAI',

      label: 'GPT 4.5 Preview',
      modelId: 'gpt-4.5-preview',
      provider: 'OpenAI',
      features: ['text', 'tools', 'image'],
      tags: ['Personal', 'Deprecated'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 16_384, enabled: true },

      credentials: 'vault',
  },
  'gpt-4o': {
      llm: 'OpenAI',
      alias: 'gpt-4o-2024-08-06',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'VisionLLM', 'AgentPlugin', 'Chatbot', 'GPTPlugin', 'GenAILLM'],

      label: 'GPT 4o',
      modelId: 'gpt-4o-2024-08-06',
      provider: 'OpenAI',
      features: ['text', 'tools', 'image', 'search', 'document'],
      tags: ['Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 16_384, searchContextTokens: 128_000, enabled: true },

      credentials: 'vault',
  },
  'gpt-4o-2024-08-06': {
      llm: 'OpenAI',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 128000, completionTokens: 16_384, enabled: true },

      credentials: 'vault',
  },
  // #endregion GPT 4o

  // #region o3 models
  'o4-mini': {
      llm: 'OpenAI',

      label: 'GPT o4 mini',
      modelId: 'o4-mini-2025-04-16',
      provider: 'OpenAI',
      features: ['text', 'reasoning'],
      tags: ['New', 'Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 100_000, enabled: true },

      credentials: 'vault',
  },
  o3: {
      llm: 'OpenAI',

      label: 'GPT o3',
      modelId: 'o3-2025-04-16',
      provider: 'OpenAI',
      features: ['text', 'reasoning'],
      tags: ['Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 100_000, enabled: true },

      credentials: 'vault',
  },
  'o3-mini': {
      llm: 'OpenAI',
      alias: 'o3-mini-2025-01-31',
      components: ['PromptGenerator', 'GenAILLM'],

      label: 'GPT o3 mini',
      modelId: 'o3-mini-2025-01-31',
      provider: 'OpenAI',
      features: ['text', 'reasoning'],
      tags: ['Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 100_000, enabled: true },
      hidden: true,

      credentials: 'vault',
  },
  'o3-mini-2025-01-31': {
      llm: 'OpenAI',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 100_000, enabled: true },

      credentials: 'vault',
  },
  // #endregion o3 models

  // #region o1 models
  o1: {
      llm: 'OpenAI',
      alias: 'o1-2024-12-17',
      components: ['PromptGenerator', 'GenAILLM'],

      label: 'GPT o1',
      modelId: 'o1-2024-12-17',
      provider: 'OpenAI',
      features: ['text', 'reasoning'],
      tags: ['Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 100_000, enabled: true },

      credentials: 'vault',
  },
  'o1-2024-12-17': {
      llm: 'OpenAI',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 100_000, enabled: true },

      credentials: 'vault',
  },
  'o1-mini': {
      llm: 'OpenAI',
      alias: 'o1-mini-2024-09-12',
      components: ['PromptGenerator', 'GenAILLM'],

      label: 'GPT o1 mini',
      modelId: 'o1-mini-2024-09-12',
      provider: 'OpenAI',
      features: ['text'],
      tags: ['Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 65_536, enabled: true },

      credentials: 'vault',
  },
  'o1-mini-2024-09-12': {
      llm: 'OpenAI',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 65_536, enabled: true },

      credentials: 'vault',
  },
  'o1-preview': {
      llm: 'OpenAI',
      alias: 'o1-preview-2024-09-12',
      components: ['PromptGenerator', 'GenAILLM'],

      label: 'GPT o1 Preview',
      modelId: 'o1-preview-2024-09-12',
      provider: 'OpenAI',
      features: ['text'],
      tags: ['Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 32_768, enabled: true },

      credentials: 'vault',
  },
  'o1-preview-2024-09-12': {
      llm: 'OpenAI',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 32_768, enabled: true },

      credentials: 'vault',
  },
  // #endregion o1 models

  // #region GPT-4-turbo
  'gpt-4-turbo-latest': {
      llm: 'OpenAI',
      alias: 'gpt-4-turbo-2024-04-09',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier'],

      label: 'GPT 4 Turbo Latest',
      modelId: 'gpt-4-turbo-2024-04-09',
      provider: 'OpenAI',
      features: ['text', 'tools'],
      tags: ['Personal', 'legacy'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 4096, enabled: true },
      hidden: true,
  },
  'gpt-4-turbo': {
      llm: 'OpenAI',
      alias: 'gpt-4-turbo-2024-04-09',
      components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'GPTPlugin', 'AgentPlugin', 'Chatbot'],

      label: 'GPT 4 Turbo',
      modelId: 'gpt-4-turbo-2024-04-09',
      provider: 'OpenAI',
      features: ['text', 'tools', 'image'],
      tags: ['Personal', 'legacy'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 4096, enabled: true },
      hidden: true,
  },
  'gpt-4-turbo-2024-04-09': {
      llm: 'OpenAI',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 128000, completionTokens: 4096, enabled: true },

      credentials: 'vault',
  },
  // #endregion GPT-4-turbo

  // #region GPT-4
  'gpt-4-latest': {
      llm: 'OpenAI',
      alias: 'gpt-4-0613',
      components: ['PromptGenerator', 'LLMAssistant'],

      label: 'GPT 4 Latest',
      modelId: 'gpt-4-0613',
      provider: 'OpenAI',
      features: ['text', 'tools'],
      tags: ['Personal', 'legacy'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
      hidden: true,
  },
  'gpt-4': {
      llm: 'OpenAI',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'GPTPlugin', 'AgentPlugin', 'Chatbot'],

      label: 'GPT 4',
      modelId: 'gpt-4o-2024-08-06',
      provider: 'OpenAI',
      features: ['text', 'tools'],
      tags: ['Personal', 'deprecated'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
      hidden: true,
  },
  'gpt-4-0613': {
      llm: 'OpenAI',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      hidden: true,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  // #endregion GPT-4

  // #region GPT-3.5
  'gpt-3.5-turbo-latest': {
      llm: 'OpenAI',
      alias: 'gpt-3.5-turbo-0125',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'GPTPlugin', 'AgentPlugin', 'Chatbot'],

      label: 'GPT 3.5 Turbo Latest',
      modelId: 'gpt-3.5-turbo-0125',
      provider: 'OpenAI',
      features: ['text', 'tools'],
      tags: ['Personal', 'legacy'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 16385, completionTokens: 4096, enabled: true },
      hidden: true,
  },
  'gpt-3.5-turbo': {
      llm: 'OpenAI',
      alias: 'gpt-3.5-turbo-0125',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'GPTPlugin', 'AgentPlugin', 'Chatbot'],

      label: 'GPT 3.5 Turbo',
      modelId: 'gpt-3.5-turbo-0125',
      provider: 'OpenAI',
      features: ['text', 'tools'],
      tags: ['Personal', 'legacy'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 16385, completionTokens: 4096, enabled: true },
      hidden: true,
  },
  'gpt-3.5-turbo-0125': {
      llm: 'OpenAI',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 16385, completionTokens: 4096, enabled: true },

      credentials: 'vault',
  },
  // #endregion GPT-3.5

  // #region GPT models for legacy plans
  // keep the gpt-4o-mini as default model for now
  'legacy/gpt-4o-mini': {
      label: 'GPT 4o Mini',
      modelId: 'gpt-4o-mini-2024-07-18',
      provider: 'OpenAI',
      features: ['text', 'tools', 'image'],
      tags: ['Legacy'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      keyOptions: { tokens: 128_000, completionTokens: 16_383, enabled: true },
  },

  // #region GPT 4.1
  'legacy/gpt-4.1-nano': {
      label: 'GPT 4.1 Nano',
      modelId: 'gpt-4.1-nano',
      provider: 'OpenAI',
      features: ['text', 'tools', 'image'],
      tags: ['Legacy'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      keyOptions: { tokens: 1_047_576, completionTokens: 32_768, enabled: true },
  },
  'legacy/gpt-4.1-mini': {
      label: 'GPT 4.1 Mini',
      modelId: 'gpt-4.1-mini',
      provider: 'OpenAI',
      features: ['text', 'tools', 'image'],
      tags: ['Legacy'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      keyOptions: { tokens: 1_047_576, completionTokens: 32_768, enabled: true },
  },
  'legacy/gpt-4.1': {
      label: 'GPT 4.1',
      modelId: 'gpt-4.1',
      provider: 'OpenAI',
      features: ['text', 'tools', 'image'],
      tags: ['Legacy'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      keyOptions: { tokens: 1_047_576, completionTokens: 32_768, enabled: true },
  },
  // #endregion

  // #region GPT 4o
  'legacy/gpt-4.5-preview': {
      label: 'GPT 4.5 Preview',
      modelId: 'gpt-4.5-preview',
      provider: 'OpenAI',
      features: ['text', 'tools', 'image'],
      tags: ['Legacy', 'Deprecated'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      keyOptions: { tokens: 128_000, completionTokens: 16_384, enabled: true },
  },
  'legacy/gpt-4o': {
      label: 'GPT 4o',
      modelId: 'gpt-4o-2024-08-06',
      provider: 'OpenAI',
      features: ['text', 'tools', 'image'],
      tags: ['Legacy'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      keyOptions: { tokens: 128_000, completionTokens: 16_384, enabled: true },
  },
  // #endregion GPT 4o

  // #region o3 models
  'legacy/o4-mini': {
      label: 'GPT o4 mini',
      modelId: 'o4-mini-2025-04-16',
      provider: 'OpenAI',
      features: ['text'],
      tags: ['Legacy'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      keyOptions: { tokens: 200_000, completionTokens: 100_000, enabled: true },
  },
  'legacy/o3': {
      label: 'GPT o3',
      modelId: 'o3-2025-04-16',
      provider: 'OpenAI',
      features: ['text'],
      tags: ['Legacy'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      keyOptions: { tokens: 200_000, completionTokens: 100_000, enabled: true },
  },
  'legacy/o3-mini': {
      label: 'GPT o3 mini',
      modelId: 'o3-mini-2025-01-31',
      provider: 'OpenAI',
      features: ['text'],
      tags: ['Legacy'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      hidden: true,
      keyOptions: { tokens: 200_000, completionTokens: 100_000, enabled: true },
  },
  // #endregion o3 models

  // #region o1 models
  'legacy/o1': {
      label: 'GPT o1',
      modelId: 'o1-2024-12-17',
      provider: 'OpenAI',
      features: ['text'],
      tags: ['Legacy'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      keyOptions: { tokens: 200_000, completionTokens: 100_000, enabled: true },
  },
  'legacy/o1-mini': {
      label: 'GPT o1 mini',
      modelId: 'o1-mini-2024-09-12',
      provider: 'OpenAI',
      features: ['text'],
      tags: ['Legacy'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      keyOptions: { tokens: 128_000, completionTokens: 65_536, enabled: true },
  },
  'legacy/o1-preview': {
      label: 'GPT o1 Preview',
      modelId: 'o1-preview-2024-09-12',
      provider: 'OpenAI',
      features: ['text'],
      tags: ['Legacy'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      keyOptions: { tokens: 128_000, completionTokens: 32_768, enabled: true },
  },
  // #endregion o1 models

  // #region GPT-4-turbo
  'legacy/gpt-4-turbo-latest': {
      label: 'GPT 4 Turbo Latest',
      modelId: 'gpt-4-turbo-2024-04-09',
      provider: 'OpenAI',
      features: ['text', 'tools'],
      tags: ['Personal', 'legacy'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      hidden: true,
      keyOptions: { tokens: 128_000, completionTokens: 4096, enabled: true },
  },
  'legacy/gpt-4-turbo': {
      label: 'GPT 4 Turbo',
      modelId: 'gpt-4-turbo-2024-04-09',
      provider: 'OpenAI',
      features: ['text', 'tools', 'image'],
      tags: ['Personal', 'legacy'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      hidden: true,
      keyOptions: { tokens: 128_000, completionTokens: 4096, enabled: true },
  },
  // #endregion GPT-4-turbo

  // #region GPT-4
  'legacy/gpt-4-latest': {
      label: 'GPT 4 Latest',
      modelId: 'gpt-4-0613',
      provider: 'OpenAI',
      features: ['text', 'tools'],
      tags: ['Personal', 'legacy'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      hidden: true,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
  },
  'legacy/gpt-4': {
      label: 'GPT 4',
      modelId: 'gpt-4o-2024-08-06',
      provider: 'OpenAI',
      features: ['text', 'tools'],
      tags: ['Personal', 'deprecated'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      hidden: true,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
  },
  // #endregion GPT-4

  // #region GPT-3.5
  'legacy/gpt-3.5-turbo-latest': {
      label: 'GPT 3.5 Turbo Latest',
      modelId: 'gpt-3.5-turbo-0125',
      provider: 'OpenAI',
      features: ['text', 'tools'],
      tags: ['Legacy', 'legacy'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      hidden: true,
      keyOptions: { tokens: 16385, completionTokens: 4096, enabled: true },
  },
  'legacy/gpt-3.5-turbo': {
      label: 'GPT 3.5 Turbo',
      modelId: 'gpt-3.5-turbo-0125',
      provider: 'OpenAI',
      features: ['text', 'tools'],
      tags: ['Legacy', 'legacy'],
      tokens: 2048,
      completionTokens: 2048,
      enabled: true,
      credentials: ['vault', 'internal'],
      hidden: true,
      keyOptions: { tokens: 16385, completionTokens: 4096, enabled: true },
  },
  // #endregion GPT-3.5
  // #endregion GPT models for legacy plans

  // #endregion OpenAI Models ==========================

  // #region Anthropic Models ==========================
  'claude-4-opus': {
      label: 'Claude 4 Opus',
      modelId: 'claude-opus-4-20250514',
      provider: 'Anthropic',
      features: ['text', 'image', 'tools', 'reasoning'],
      tags: ['New', 'Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 32000, maxReasoningTokens: 32000, enabled: true },

      credentials: 'internal',
  },
  'claude-4-sonnet': {
      label: 'Claude 4 Sonnet',
      modelId: 'claude-sonnet-4-20250514',
      provider: 'Anthropic',
      features: ['text', 'image', 'tools', 'reasoning'],
      tags: ['New', 'Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 64000, maxReasoningTokens: 32000, enabled: true },

      credentials: 'vault',
  },
  'claude-3.7-sonnet': {
      llm: 'Anthropic',
      alias: 'claude-3-7-sonnet-20250219',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'VisionLLM', 'AgentPlugin', 'Chatbot', 'GenAILLM'],

      label: 'Claude 3.7 Sonnet',
      modelId: 'claude-3-7-sonnet-20250219',
      provider: 'Anthropic',
      features: ['text', 'tools', 'image', 'reasoning'],
      tags: ['Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 8192, maxReasoningTokens: 16384, enabled: true },

      credentials: 'vault',
  },
  'claude-3.7-sonnet-thinking': {
      llm: 'Anthropic',
      alias: 'claude-3-7-sonnet-20250219',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'VisionLLM', 'AgentPlugin', 'Chatbot', 'GenAILLM'],

      label: 'Claude 3.7 Sonnet Thinking',
      modelId: 'claude-3-7-sonnet-20250219',
      provider: 'Anthropic',
      features: ['text', 'tools', 'image', 'reasoning'],
      tags: ['Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 16384, maxReasoningTokens: 16384, enabled: true },
      hidden: true,

      credentials: 'vault',
  },
  'claude-3.5-haiku': {
      llm: 'Anthropic',
      alias: 'claude-3-5-haiku-latest',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'AgentPlugin', 'Chatbot', 'GenAILLM'],

      label: 'Claude 3.5 Haiku',
      modelId: 'claude-3-5-haiku-latest',
      provider: 'Anthropic',
      features: ['text', 'tools'],
      tags: ['Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'claude-3-5-haiku-latest': {
      llm: 'Anthropic',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 200000, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'claude-3-5-sonnet-latest': {
      llm: 'Anthropic',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'VisionLLM', 'AgentPlugin', 'Chatbot', 'GenAILLM'],

      label: 'Claude 3.5 Sonnet Latest',
      modelId: 'claude-3-5-sonnet-latest',
      provider: 'Anthropic',
      features: ['text', 'tools', 'image'],
      tags: ['Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'claude-3.5-sonnet': {
      llm: 'Anthropic',
      alias: 'claude-3-5-sonnet-20240620',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'VisionLLM', 'AgentPlugin', 'Chatbot', 'GenAILLM'],

      label: 'Claude 3.5 Sonnet Stable',
      modelId: 'claude-3-5-sonnet-20240620',
      provider: 'Anthropic',
      features: ['text', 'tools', 'image'],
      tags: ['Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'claude-3-5-sonnet-20240620': {
      llm: 'Anthropic',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 200000, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'claude-3-opus': {
      llm: 'Anthropic',
      alias: 'claude-3-opus-20240229',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'VisionLLM', 'AgentPlugin', 'Chatbot', 'GenAILLM'],

      label: 'Claude 3 Opus',
      modelId: 'claude-3-opus-20240229',
      provider: 'Anthropic',
      features: ['text', 'tools', 'image'],
      tags: ['Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 4096, enabled: true },

      credentials: 'vault',
  },
  'claude-3-opus-20240229': {
      llm: 'Anthropic',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 200000, completionTokens: 4096, enabled: true },

      credentials: 'vault',
  },
  'claude-3-sonnet': {
      llm: 'Anthropic',
      alias: 'claude-3-sonnet-20240229',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'VisionLLM', 'AgentPlugin', 'Chatbot'],

      label: 'Claude 3 Sonnet',
      modelId: 'claude-3-sonnet-20240229',
      provider: 'Anthropic',
      features: ['text', 'tools', 'image'],
      tags: ['Personal', 'deprecated'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 4096, enabled: true },
      hidden: true,

      credentials: 'vault',
  },
  'claude-3-sonnet-20240229': {
      llm: 'Anthropic',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 200000, completionTokens: 4096, enabled: true },

      credentials: 'vault',
  },
  'claude-3-haiku': {
      llm: 'Anthropic',
      alias: 'claude-3-haiku-20240307',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'VisionLLM', 'AgentPlugin', 'Chatbot'],

      label: 'Claude 3 Haiku',
      modelId: 'claude-3-haiku-20240307',
      provider: 'Anthropic',
      features: ['text', 'tools', 'image'],
      tags: ['Personal', 'legacy'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 4096, enabled: true },
      hidden: true,

      credentials: 'vault',
  },
  'claude-3-haiku-20240307': {
      llm: 'Anthropic',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 200000, completionTokens: 4096, enabled: true },

      credentials: 'vault',
  },
  'claude-2.1': {
      llm: 'Anthropic',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier'],

      label: 'Claude 2.1',
      modelId: 'claude-2.1',
      provider: 'Anthropic',
      features: ['text', 'image'],
      tags: ['Personal', 'legacy'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 200_000, completionTokens: 4096, enabled: true },
      hidden: true,
  },
  'claude-instant-1.2': {
      llm: 'Anthropic',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier'],

      label: 'Claude Instant 1.2',
      modelId: 'claude-instant-1.2',
      provider: 'Anthropic',
      features: ['text', 'image'],
      tags: ['Personal', 'legacy'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 100_000, completionTokens: 4096, enabled: true },
      hidden: true,

      credentials: 'vault',
  },

  // #endregion Anthropic Models ==========================

  // #region Google AI Models ==========================

  // #region Gemini 2.0 flash
  'gemini-2.5-flash': {
      llm: 'GoogleAI',

      label: 'Gemini 2.5 Flash Preview',
      modelId: 'gemini-2.5-flash-preview-04-17',
      provider: 'GoogleAI',
      features: ['text', 'image', 'audio', 'video', 'document'],
      tags: ['New', 'Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 1_048_576, completionTokens: 65_536, enabled: true },

      credentials: 'vault',
  },
  'gemini-2.0-flash': {
      llm: 'GoogleAI',
      components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'MultimodalLLM', 'GenAILLM'],

      label: 'Gemini 2.0 Flash',
      modelId: 'gemini-2.0-flash',
      provider: 'GoogleAI',
      features: ['text', 'image', 'audio', 'video', 'document'],
      tags: ['Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 1_048_576, completionTokens: 8_192, enabled: true },
      hidden: true,

      credentials: 'vault',
  },
  'gemini-2.0-flash-lite': {
      llm: 'GoogleAI',

      label: 'Gemini 2.0 Flash Lite',
      modelId: 'gemini-2.0-flash-lite',
      provider: 'GoogleAI',
      features: ['text', 'image', 'audio', 'video', 'document'],
      tags: ['Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 1_048_576, completionTokens: 8_192, enabled: true },
      hidden: true,

      credentials: 'vault',
  },
  'gemini-2.5-pro': {
      llm: 'GoogleAI',
      components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'MultimodalLLM', 'GenAILLM'],

      label: 'Gemini 2.5 Pro Preview',
      modelId: 'gemini-2.5-pro-preview-03-25',
      provider: 'GoogleAI',
      features: ['text', 'image', 'audio', 'video', 'document'],
      tags: ['Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 1_048_576, completionTokens: 65_536, enabled: true },

      credentials: 'vault',
  },
  'gemini-2.5-pro-exp': {
      llm: 'GoogleAI',
      components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'MultimodalLLM', 'GenAILLM'],

      label: 'Gemini 2.5 Pro Experimental',
      modelId: 'gemini-2.5-pro-exp-03-25',
      provider: 'GoogleAI',
      features: ['text', 'image', 'audio', 'video', 'document'],
      tags: ['New', 'Personal'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 1_048_576, completionTokens: 65_536, enabled: true },

      credentials: 'vault',
  },
  // #endregion Gemini 2.0 flash

  // #region Gemini 1.5 pro
  'gemini-1.5-pro-exp-0801': {
      llm: 'GoogleAI',
      components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'MultimodalLLM', 'GenAILLM'],

      label: 'Gemini 1.5 Pro Experimental',
      modelId: 'gemini-1.5-pro-exp-0801',
      provider: 'GoogleAI',
      features: ['text', 'image', 'audio', 'video', 'document'],
      tags: ['Personal', 'deprecated'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 2_097_152, completionTokens: 8192, enabled: true },
      hidden: true,

      credentials: 'vault',
  },
  'gemini-1.5-pro-latest-stable': {
      llm: 'GoogleAI',
      alias: 'gemini-1.5-pro',
      components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'MultimodalLLM', 'GenAILLM'],

      label: 'Gemini 1.5 Pro Latest Stable',
      modelId: 'gemini-1.5-pro',
      provider: 'GoogleAI',
      features: ['text', 'image', 'audio', 'video', 'document'],
      tags: ['Personal', 'deprecated'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 2_097_152, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'gemini-1.5-pro-latest': {
      llm: 'GoogleAI',
      components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'MultimodalLLM'],

      label: 'Gemini 1.5 Pro',
      modelId: 'gemini-1.5-pro',
      provider: 'GoogleAI',
      tags: ['Personal', 'deprecated'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 2_097_152, completionTokens: 8_192, enabled: true },
      hidden: true,

      credentials: 'vault',
  },
  'gemini-1.5-pro-stable': {
      llm: 'GoogleAI',
      alias: 'gemini-1.5-pro-001',
      components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'MultimodalLLM', 'GenAILLM'],

      label: 'Gemini 1.5 Pro Stable',
      modelId: 'gemini-1.5-pro',
      provider: 'GoogleAI',
      features: ['text', 'image', 'audio', 'video', 'document'],
      tags: ['Personal', 'deprecated'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 2_097_152, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'gemini-1.5-pro': {
      llm: 'GoogleAI',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 2097152, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'gemini-1.5-pro-001': {
      llm: 'GoogleAI',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 2097152, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  // #endregion Gemini 1.5 pro

  // #region Gemini 1.5 flash
  'gemini-1.5-flash-latest': {
      llm: 'GoogleAI',
      components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'MultimodalLLM'],

      label: 'Gemini 1.5 Flash Latest',
      modelId: 'gemini-1.5-flash-latest',
      provider: 'GoogleAI',
      features: ['text', 'image', 'audio', 'video', 'document'],
      tags: ['Personal', 'deprecated'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 1_048_576, completionTokens: 8192, enabled: true },
      hidden: true,

      credentials: 'vault',
  },
  'gemini-1.5-flash-latest-stable': {
      llm: 'GoogleAI',
      alias: 'gemini-1.5-flash',
      components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'MultimodalLLM'],

      label: 'Gemini 1.5 Flash Latest Stable',
      modelId: 'gemini-1.5-flash',
      provider: 'GoogleAI',
      features: ['text', 'image', 'audio', 'video', 'document'],
      tags: ['Personal', 'deprecated'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 1_048_576, completionTokens: 8192, enabled: true },
      hidden: true,

      credentials: 'vault',
  },
  'gemini-1.5-flash-stable': {
      llm: 'GoogleAI',
      alias: 'gemini-1.5-flash-001',
      components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'MultimodalLLM', 'GenAILLM'],

      label: 'Gemini 1.5 Flash Stable',
      modelId: 'gemini-1.5-flash-001',
      provider: 'GoogleAI',
      features: ['text', 'image', 'audio', 'video', 'document'],
      tags: ['Personal', 'deprecated'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 1_048_576, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'gemini-1.5-flash': {
      llm: 'GoogleAI',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 1048576, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'gemini-1.5-flash-001': {
      llm: 'GoogleAI',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 1048576, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  // #endregion Gemini 1.5 flash

  // #region Gemini 1.0 pro
  'gemini-1.0-pro-latest': {
      llm: 'GoogleAI',
      components: ['PromptGenerator', 'LLMAssistant'],

      label: 'Gemini 1.0 Pro Latest',
      modelId: 'gemini-1.0-pro-latest',
      provider: 'GoogleAI',
      features: ['text'],
      tags: ['Personal', 'legacy'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 30_720, completionTokens: 8192, enabled: true },
      hidden: true,

      credentials: 'vault',
  },
  'gemini-1.0-pro-latest-stable': {
      llm: 'GoogleAI',
      alias: 'gemini-1.0-pro',
      components: ['PromptGenerator', 'LLMAssistant'],

      label: 'Gemini 1.0 Pro Latest Stable',
      modelId: 'gemini-1.0-pro',
      provider: 'GoogleAI',
      features: ['text'],
      tags: ['Personal', 'legacy'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 30_720, completionTokens: 8192, enabled: true },
      hidden: true,

      credentials: 'vault',
  },
  'gemini-1.0-pro-stable': {
      llm: 'GoogleAI',
      alias: 'gemini-1.0-pro-001',
      components: ['PromptGenerator', 'LLMAssistant'],

      label: 'Gemini 1.0 Pro Stable',
      modelId: 'gemini-1.0-pro-001',
      provider: 'GoogleAI',
      features: ['text'],
      tags: ['Personal', 'legacy'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 30_720, completionTokens: 8192, enabled: true },
      hidden: true,

      credentials: 'vault',
  },
  'gemini-1.0-pro': {
      llm: 'GoogleAI',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 30_720, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'gemini-1.0-pro-001': {
      llm: 'GoogleAI',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 30_720, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  // #endregion Gemini 1.0 pro

  // #region Gemini Pro Vision
  'gemini-pro-vision': {
      llm: 'GoogleAI',
      components: ['VisionLLM'],

      label: 'Gemini Pro Vision',
      modelId: 'gemini-pro-vision',
      provider: 'GoogleAI',
      features: ['image'],
      tags: ['Personal', 'legacy'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 12_288, completionTokens: 4096, enabled: true },
      hidden: true,

      credentials: 'vault',
  },
  // #endregion Gemini Pro Vision

  // #endregion Google AI Models ==========================

  // #region Groq Models ==========================

  // #region Groq - Production Models
  'llama-3.3-70b': {
      llm: 'Groq',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Meta - Llama 3.3 70B',
      modelId: 'llama-3.3-70b-versatile',
      provider: 'Groq',
      features: ['text'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 32_768, enabled: true },

      credentials: 'vault',
  },
  'groq-llama3-70b': {
      llm: 'Groq',
      alias: 'llama3-70b-8192',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Meta - Llama 3 70B',
      modelId: 'llama3-70b-8192',
      provider: 'Groq',
      features: ['text'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'llama3-70b-8192': {
      llm: 'Groq',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'groq-llama-3.1-8b-instant': {
      llm: 'Groq',
      alias: 'llama-3.1-8b-instant',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Meta - Llama 3.1 8B',
      modelId: 'llama-3.1-8b-instant',
      provider: 'Groq',
      features: ['text'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'llama-3.1-8b-instant': {
      llm: 'Groq',
      tokens: 8000,
      completionTokens: 8000,
      enabled: false,
      keyOptions: { tokens: 131072, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'llama-guard-3-8b': {
      llm: 'Groq',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Meta - Llama Guard 3 8B',
      modelId: 'llama-guard-3-8b',
      provider: 'Groq',
      features: ['text'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'groq-llama3-8b': {
      llm: 'Groq',
      alias: 'llama3-8b-8192',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Meta - Llama 3 8B',
      modelId: 'llama3-8b-8192',
      provider: 'Groq',
      features: ['text'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'llama3-8b-8192': {
      llm: 'Groq',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'groq-gemma2-9b': {
      llm: 'Groq',
      alias: 'gemma2-9b-it',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Google - Gemma 2 9B',
      modelId: 'gemma2-9b-it',
      provider: 'Groq',
      features: ['text'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'gemma2-9b-it': {
      llm: 'Groq',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'groq-mixtral-8x7b': {
      llm: 'Groq',
      alias: 'mixtral-8x7b-32768',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Mistral - Mixtral 8x7b',
      modelId: 'mixtral-8x7b-32768',
      provider: 'Groq',
      features: ['text'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 32_768, completionTokens: 32_768, enabled: true },

      credentials: 'vault',
  },
  'mixtral-8x7b-32768': {
      llm: 'Groq',
      tokens: 2048,
      completionTokens: 2048,
      enabled: false,
      keyOptions: { tokens: 32768, completionTokens: 32768, enabled: true },

      credentials: 'vault',
  },
  // #endregion Groq - Production Models

  // #region Groq - Preview Models
  'qwen-qwq-32b': {
      llm: 'Groq',

      label: 'Qwen - QWQ 32b Preview',
      modelId: 'qwen-qwq-32b',
      provider: 'Groq',
      features: ['text'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 16_384, enabled: true },

      credentials: 'vault',
  },
  'mistral-saba-24b': {
      llm: 'Groq',

      label: 'Mistral - Saba 24b Preview',
      modelId: 'mistral-saba-24b',
      provider: 'Groq',
      features: ['text'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 16_384, enabled: true },

      credentials: 'vault',
  },
  'qwen-2.5-coder-32b': {
      llm: 'Groq',

      label: 'Qwen - 2.5 Coder 32b Preview',
      modelId: 'qwen-2.5-coder-32b',
      provider: 'Groq',
      features: ['text'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 16_384, enabled: true },

      credentials: 'vault',
  },
  'qwen-2.5-32b': {
      llm: 'Groq',

      label: 'Qwen - 2.5 32b Preview',
      modelId: 'qwen-2.5-32b',
      provider: 'Groq',
      features: ['text'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 16_384, enabled: true },

      credentials: 'vault',
  },
  'deepseek-r1-distill-qwen-32b': {
      llm: 'Groq',

      label: 'DeepSeek - R1 Distill Qwen 32b Preview',
      modelId: 'deepseek-r1-distill-qwen-32b',
      provider: 'Groq',
      features: ['text'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 16_384, enabled: true },

      credentials: 'vault',
  },
  'deepseek-r1-distill-llama-70b': {
      llm: 'Groq',

      label: 'DeepSeek - R1 Distill Llama 70b Preview',
      modelId: 'deepseek-r1-distill-llama-70b',
      provider: 'Groq',
      features: ['text'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  // #endregion Groq - Meta Preview Models
  'meta-llama/llama-4-scout-17b-16e-instruct': {
      llm: 'Groq',

      label: 'Meta - Llama 4 Scout 17B 16E Instruct',
      modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
      provider: 'Groq',
      features: ['text'],
      tags: ['New', 'Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 131_072, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'llama-3.3-70b-specdec': {
      llm: 'Groq',

      label: 'Meta - Llama 3.3 70B SpecDec Preview',
      modelId: 'llama-3.3-70b-specdec',
      provider: 'Groq',
      features: ['text'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'llama-3.2-1b-preview': {
      llm: 'Groq',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Meta - Llama 3.2 1B Preview',
      modelId: 'llama-3.2-1b-preview',
      provider: 'Groq',
      features: ['text'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'llama-3.2-3b-preview': {
      llm: 'Groq',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Meta - Llama 3.2 3B Preview',
      modelId: 'llama-3.2-3b-preview',
      provider: 'Groq',
      features: ['text'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 8192, enabled: true },

      credentials: 'vault',
  },
  'llama-3.2-11b-vision-preview': {
      llm: 'Groq',
      components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'GenAILLM'],

      label: 'Meta - Llama 3.2 11B Vision Preview',
      modelId: 'llama-3.2-11b-vision-preview',
      provider: 'Groq',
      features: ['text', 'image'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 8192, enabled: true },
      hidden: true, // !TEMP: we need to support image input for Groq

      credentials: 'vault',
  },
  'llama-3.2-90b-vision-preview': {
      llm: 'Groq',

      label: 'Meta - Llama 3.2 90b Vision Preview',
      modelId: 'llama-3.2-90b-vision-preview',
      provider: 'Groq',
      features: ['text', 'image'],
      tags: ['Personal', 'Groq'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 8192, enabled: true },
      hidden: true, // !TEMP: we need to support image input for Groq

      credentials: 'vault',
  },
  // #endregion Groq - Meta Preview Models

  // #endregion Groq - Preview Models

  // #endregion Groq Models ==========================

  // #region Together AI Models ==========================

  // #region Together AI - DeepSeek
  'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B': {
      llm: 'TogetherAI',

      label: 'DeepSeek - R1 Distill Qwen 14B',
      modelId: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['New', 'Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 131_072, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B': {
      llm: 'TogetherAI',

      label: 'DeepSeek - R1 Distill Qwen 1.5B',
      modelId: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['New', 'Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 131_072, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'deepseek-ai/DeepSeek-R1-Distill-Llama-70B': {
      llm: 'TogetherAI',

      label: 'DeepSeek - R1 Distill Llama 70B',
      modelId: 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['New', 'Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 131_072, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'deepseek-ai/DeepSeek-R1': {
      llm: 'TogetherAI',

      label: 'DeepSeek - R1',
      modelId: 'deepseek-ai/DeepSeek-R1',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 128_000, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'deepseek-ai/DeepSeek-V3': {
      llm: 'TogetherAI',

      label: 'DeepSeek - V3',
      modelId: 'deepseek-ai/DeepSeek-V3',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 131_072, completionTokens: 8192, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'deepseek-ai/deepseek-llm-67b-chat': {
      llm: 'TogetherAI',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'DeepSeek - Llama 67B Chat',
      modelId: 'deepseek-ai/deepseek-llm-67b-chat',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 4096, completionTokens: 4096, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  // #endregion Together AI - DeepSeek

  // #region Together AI - Meta
  'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8': {
      llm: 'TogetherAI',

      label: 'Meta - Llama 4 Maverick (17Bx128E)',
      modelId: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
      provider: 'TogetherAI',
      features: ['text', 'tools', 'image'],
      tags: ['New', 'Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 524_288, completionTokens: 524_288, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'meta-llama/Llama-4-Scout-17B-16E-Instruct': {
      llm: 'TogetherAI',

      label: 'Meta - Llama 4 Scout (17Bx16E)',
      modelId: 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
      provider: 'TogetherAI',
      features: ['text', 'tools', 'image'],
      tags: ['New', 'Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 327_680, completionTokens: 327_680, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'meta-llama/Llama-3.3-70B-Instruct-Turbo': {
      llm: 'TogetherAI',

      label: 'Meta - Llama 3.3 70B Instruct Turbo',
      modelId: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      provider: 'TogetherAI',
      features: ['text', 'tools'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 131_072, completionTokens: 131_072, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo': {
      llm: 'TogetherAI',
      components: ['LLMAssistant', 'PromptGenerator', 'GenAILLM'],

      label: 'Meta - Llama 3.1 8B Instruct Turbo',
      modelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      provider: 'TogetherAI',
      features: ['text', 'tools'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 131_072, completionTokens: 131_072, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo': {
      llm: 'TogetherAI',
      components: ['LLMAssistant', 'PromptGenerator', 'GenAILLM'],

      label: 'Meta - Llama 3.1 70B Instruct Turbo',
      modelId: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      provider: 'TogetherAI',
      features: ['text', 'tools'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 131_072, completionTokens: 131_072, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo': {
      llm: 'TogetherAI',
      components: ['LLMAssistant', 'PromptGenerator', 'GenAILLM'],

      label: 'Meta - Llama 3.1 405B Instruct Turbo',
      modelId: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
      provider: 'TogetherAI',
      features: ['text', 'tools'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 130_815, completionTokens: 130_815, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'meta-llama/Meta-Llama-3-8B-Instruct-Turbo': {
      llm: 'TogetherAI',
      components: ['LLMAssistant', 'PromptGenerator', 'GenAILLM'],

      label: 'Meta - Llama 3 8B Instruct Turbo',
      modelId: 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'meta-llama/Meta-Llama-3-70B-Instruct-Turbo': {
      llm: 'TogetherAI',
      components: ['LLMAssistant', 'PromptGenerator', 'GenAILLM'],

      label: 'Meta - Llama 3 70B Instruct Turbo',
      modelId: 'meta-llama/Meta-Llama-3-70B-Instruct-Turbo',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'meta-llama/Llama-3.2-3B-Instruct-Turbo': {
      llm: 'TogetherAI',

      label: 'Meta - Llama 3.2 3B Instruct Turbo',
      modelId: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 131_072, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'meta-llama/Meta-Llama-3-8B-Instruct-Lite': {
      llm: 'TogetherAI',
      components: ['LLMAssistant', 'PromptGenerator', 'GenAILLM'],

      label: 'Meta - Llama 3 8B Instruct Lite',
      modelId: 'meta-llama/Meta-Llama-3-8B-Instruct-Lite',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'meta-llama/Meta-Llama-3-70B-Instruct-Lite': {
      llm: 'TogetherAI',
      components: ['LLMAssistant', 'PromptGenerator', 'GenAILLM'],

      label: 'Meta - Llama 3 70B Instruct Lite',
      modelId: 'meta-llama/Meta-Llama-3-70B-Instruct-Lite',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'meta-llama/Llama-3-8b-chat-hf': {
      llm: 'TogetherAI',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Meta - Llama 3 8B Chat',
      modelId: 'meta-llama/Llama-3-8b-chat-hf',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'meta-llama/Llama-3-70b-chat-hf': {
      llm: 'TogetherAI',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Meta - Llama 3 70B Chat',
      modelId: 'meta-llama/Llama-3-70b-chat-hf',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'meta-llama/Llama-2-13b-chat-hf': {
      llm: 'TogetherAI',
      components: ['LLMAssistant'], // * Excluded from 'PromptGenerator' (has introductory text with JSON response)

      label: 'Meta - Llama 2 13B Chat',
      modelId: 'meta-llama/Llama-2-13b-chat-hf',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 4096, completionTokens: 4096, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'meta-llama/Llama-Vision-Free': {
      llm: 'TogetherAI',
      components: ['LLMAssistant', 'PromptGenerator', 'VisionLLM', 'GenAILLM'],

      label: 'Meta - Llama Vision Free',
      modelId: 'meta-llama/Llama-Vision-Free',
      provider: 'TogetherAI',
      features: ['text', 'image'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 131072, completionTokens: 131072, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo': {
      llm: 'TogetherAI',
      components: ['LLMAssistant', 'PromptGenerator', 'VisionLLM', 'GenAILLM'],

      label: 'Meta - Llama 3.2 11B Vision Instruct Turbo',
      modelId: 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo',
      provider: 'TogetherAI',
      features: ['text', 'image'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 131072, completionTokens: 131072, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo': {
      llm: 'TogetherAI',
      components: ['LLMAssistant', 'PromptGenerator', 'VisionLLM', 'GenAILLM'],

      label: 'Meta - Llama 3.2 90B Vision Instruct Turbo',
      modelId: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
      provider: 'TogetherAI',
      features: ['text', 'image'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 131072, completionTokens: 131072, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  // #endregion Together AI - Meta

  // #region Together AI - Google
  'google/gemma-2-27b-it': {
      llm: 'TogetherAI',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Google - Gemma 2 27B',
      modelId: 'google/gemma-2-27b-it',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'google/gemma-2-9b-it': {
      llm: 'TogetherAI',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Google - Gemma 2 9B',
      modelId: 'google/gemma-2-9b-it',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'google/gemma-2b-it': {
      llm: 'TogetherAI',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Google - Gemma 2 2B',
      modelId: 'google/gemma-2b-it',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  // #endregion Together AI - Google

  // #region Together AI - Mistral
  'mistralai/Mistral-7B-Instruct-v0.3': {
      llm: 'TogetherAI',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'GenAILLM'],

      label: 'Mistral - 7B Instruct v0.3',
      modelId: 'mistralai/Mistral-7B-Instruct-v0.3',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 32_768, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'mistralai/Mistral-7B-Instruct-v0.2': {
      llm: 'TogetherAI',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Mistral - 7B Instruct v0.2',
      modelId: 'mistralai/Mistral-7B-Instruct-v0.2',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 32_768, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'mistralai/Mistral-7B-Instruct-v0.1': {
      llm: 'TogetherAI',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Mistral - 7B Instruct v0.1',
      modelId: 'mistralai/Mistral-7B-Instruct-v0.1',
      provider: 'TogetherAI',
      features: ['text', 'tools'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'mistralai/Mixtral-8x7B-Instruct-v0.1': {
      llm: 'TogetherAI',
      components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'GenAILLM'],

      label: 'Mistral - 8x7B Instruct v0.1',
      modelId: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      provider: 'TogetherAI',
      features: ['text', 'tools'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 32_768, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'mistralai/Mixtral-8x22B-Instruct-v0.1': {
      llm: 'TogetherAI',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Mistral - 8x22B Instruct v0.1',
      modelId: 'mistralai/Mixtral-8x22B-Instruct-v0.1',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 65_536, completionTokens: 65_536, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  // #endregion Together AI - Mistral

  // #region Together AI - Qwen
  'Qwen/Qwen2.5-Coder-32B-Instruct': {
      llm: 'TogetherAI',

      label: 'Qwen - 2.5 Coder 32B',
      modelId: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['New', 'Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 32_768, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'Qwen/QwQ-32B-Preview': {
      llm: 'TogetherAI',

      label: 'Qwen - QwQ 32B Preview',
      modelId: 'Qwen/QwQ-32B-Preview',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['New', 'Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 32_768, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'Qwen/Qwen2.5-7B-Instruct-Turbo': {
      llm: 'TogetherAI',

      label: 'Qwen - 2.5 7B Instruct Turbo',
      modelId: 'Qwen/Qwen2.5-7B-Instruct-Turbo',
      provider: 'TogetherAI',
      features: ['text', 'tools'],
      tags: ['New', 'Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 32_768, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'Qwen/Qwen2.5-72B-Instruct-Turbo': {
      llm: 'TogetherAI',

      label: 'Qwen - 2.5 72B Instruct Turbo',
      modelId: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
      provider: 'TogetherAI',
      features: ['text', 'tools'],
      tags: ['New', 'Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 32_768, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'Qwen/Qwen2-72B-Instruct': {
      llm: 'TogetherAI',

      label: 'Qwen - 2 72B Instruct',
      modelId: 'Qwen/Qwen2-72B-Instruct',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['New', 'Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 32_768, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  'Qwen/Qwen2-VL-72B-Instruct': {
      llm: 'TogetherAI',

      label: 'Qwen - 2 VL 72B Instruct',
      modelId: 'Qwen/Qwen2-VL-72B-Instruct',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['New', 'Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 32_768, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  // #endregion Together AI - Qwen

  // #region Together AI - Nvidia
  'nvidia/Llama-3.1-Nemotron-70B-Instruct-HF': {
      llm: 'TogetherAI',

      label: 'Nvidia - Llama 3.1 Nemotron 70B',
      modelId: 'nvidia/Llama-3.1-Nemotron-70B-Instruct-HF',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['New', 'Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 32_768, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  // #endregion Together AI - Nvidia

  // #region Together AI - Microsoft
  'microsoft/WizardLM-2-8x22B': {
      llm: 'TogetherAI',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Microsoft - WizardLM 2 8x22B',
      modelId: 'microsoft/WizardLM-2-8x22B',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 65_536, completionTokens: 65_536, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  // #endregion Together AI - Microsoft

  // #region Together AI - databricks
  'databricks/dbrx-instruct': {
      llm: 'TogetherAI',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Databricks - DBRX Instruct',
      modelId: 'databricks/dbrx-instruct',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 32_768, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  // #endregion Together AI - databricks

  // #region Together AI - NousResearch
  'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO': {
      llm: 'TogetherAI',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'NousResearch - Hermes 2 Mixtral 8x7B DPO',
      modelId: 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 32_768, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  // #endregion Together AI - NousResearch

  // #region Together AI - Upstage
  'upstage/SOLAR-10.7B-Instruct-v1.0': {
      llm: 'TogetherAI',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Upstage - SOLAR 10.7B Instruct v1.0',
      modelId: 'upstage/SOLAR-10.7B-Instruct-v1.0',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 4096, completionTokens: 4096, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  // #endregion Together AI - Upstage

  // #region Together AI - Gryphe
  'Gryphe/MythoMax-L2-13b': {
      llm: 'TogetherAI',
      components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

      label: 'Gryphe - MythoMax L2 13B',
      modelId: 'Gryphe/MythoMax-L2-13b',
      provider: 'TogetherAI',
      features: ['text'],
      tags: ['Personal', 'TogetherAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 4096, completionTokens: 4096, enabled: true },

      baseURL: 'https://api.together.xyz/v1',

      credentials: 'vault',
  },
  // #endregion Together AI - Gryphe

  // #endregion Together AI Models ==========================

  // #region Image Generation Models ============================

  // #region OpenAI Models gpt-image-1
  'smythos/gpt-image-1': {
      label: 'GPT Image 1',
      modelId: 'gpt-image-1',
      provider: 'OpenAI',
      features: ['image-generation'],
      tags: ['New', 'SmythOS'],
      enabled: true,

      credentials: 'internal',
  },
  'gpt-image-1': {
      label: 'GPT Image 1',
      modelId: 'gpt-image-1',
      provider: 'OpenAI',
      features: ['image-generation'],
      tags: ['New', 'Personal'],
      enabled: false,
      keyOptions: { enabled: true },

      credentials: 'vault',
  },
  // #endregion gpt-image-1

  // #region OpenAI Models DALL-E
  'dall-e-3': {
      label: 'DALL·E 3',
      modelId: 'dall-e-3',
      provider: 'OpenAI',
      features: ['image-generation'],
      tags: ['Deprecated'],
      enabled: true,

      credentials: 'vault',
  },
  'dall-e-2': {
      label: 'DALL·E 2',
      modelId: 'dall-e-2',
      provider: 'OpenAI',
      features: ['image-generation'],
      tags: ['Deprecated'],
      enabled: true,

      credentials: 'vault',
  },
  // #endregion OpenAI Models DALL-E

  // #region Runware Models
  'smythos/flux.1-schnell': {
      label: 'FLUX Schnell',
      modelId: 'runware:100@1',
      provider: 'Runware',
      features: [
          'image-generation', // Legacy
          'text-to-image',
          'image-to-image',
      ],
      tags: ['SmythOS', '1.0'],
      enabled: true,

      credentials: 'internal',
  },
  'smythos/flux.1-dev': {
      label: 'FLUX Dev',
      modelId: 'runware:101@1',
      provider: 'Runware',
      features: [
          'image-generation', // Legacy
          'text-to-image',
          'image-to-image',
      ],
      tags: ['SmythOS', '1.0'],
      enabled: true,

      credentials: 'internal',
  },
  // #region Full face detection models
  'smythos/face_yolov8n': {
      label: 'Face YOLOv8n',
      modelId: 'runware:35@1',
      provider: 'Runware',
      features: ['image-inpainting'],
      tags: ['SmythOS', 'Full face detection'],
      enabled: true,

      credentials: 'internal',
  },
  'smythos/face_yolov8s': {
      label: 'Face YOLOv8s',
      modelId: 'runware:35@2',
      provider: 'Runware',
      features: ['image-inpainting'],
      tags: ['SmythOS', 'Full face detection'],
      enabled: true,

      credentials: 'internal',
  },
  'smythos/mediapipe_face_full': {
      label: 'MediaPipe Face Full',
      modelId: 'runware:35@6',
      provider: 'Runware',
      features: ['image-inpainting'],
      tags: ['SmythOS', 'Full face detection'],
      enabled: true,

      credentials: 'internal',
  },
  'smythos/mediapipe_face_short': {
      label: 'MediaPipe Face Short',
      modelId: 'runware:35@7',
      provider: 'Runware',
      features: ['image-inpainting'],
      tags: ['SmythOS', 'Full face detection'],
      enabled: true,

      credentials: 'internal',
  },
  'smythos/mediapipe_face_mesh': {
      label: 'MediaPipe Face Mesh',
      modelId: 'runware:35@8',
      provider: 'Runware',
      features: ['image-inpainting'],
      tags: ['SmythOS', 'Full face detection'],
      enabled: true,

      credentials: 'internal',
  },
  // #endregion Full face detection models

  // #region Facial features models
  'smythos/mediapipe_face_mesh_eyes_only': {
      label: 'MediaPipe Face Mesh Eyes Only',
      modelId: 'runware:35@9',
      provider: 'Runware',
      features: ['image-inpainting'],
      tags: ['SmythOS', 'Facial features'],
      enabled: true,

      credentials: 'internal',
  },
  'smythos/eyes_mesh_mediapipe': {
      label: 'Eyes Mesh MediaPipe',
      modelId: 'runware:35@15',
      provider: 'Runware',
      features: ['image-inpainting'],
      tags: ['SmythOS', 'Facial features'],
      enabled: true,

      credentials: 'internal',
  },
  'smythos/nose_mesh_mediapipe': {
      label: 'Nose Mesh MediaPipe',
      modelId: 'runware:35@13',
      provider: 'Runware',
      features: ['image-inpainting'],
      tags: ['SmythOS', 'Facial features'],
      enabled: true,

      credentials: 'internal',
  },
  'smythos/lips_mesh_mediapipe': {
      label: 'Lips Mesh MediaPipe',
      modelId: 'runware:35@14',
      provider: 'Runware',
      features: ['image-inpainting'],
      tags: ['SmythOS', 'Facial features'],
      enabled: true,

      credentials: 'internal',
  },
  'smythos/eyes_lips_mesh': {
      label: 'Eyes & Lips Mesh',
      modelId: 'runware:35@10',
      provider: 'Runware',
      features: ['image-inpainting'],
      tags: ['SmythOS', 'Facial features'],
      enabled: true,

      credentials: 'internal',
  },
  'smythos/nose_eyes_mesh': {
      label: 'Nose & Eyes Mesh',
      modelId: 'runware:35@11',
      provider: 'Runware',
      features: ['image-inpainting'],
      tags: ['SmythOS', 'Facial features'],
      enabled: true,

      credentials: 'internal',
  },
  'smythos/nose_lips_mesh': {
      label: 'Nose & Lips Mesh',
      modelId: 'runware:35@12',
      provider: 'Runware',
      features: ['image-inpainting'],
      tags: ['SmythOS', 'Facial features'],
      enabled: true,
  },
  // #endregion Facial features models

  // #region Other body parts models
  'smythos/hand_yolov8n': {
      label: 'Hand YOLOv8n',
      modelId: 'runware:35@3',
      provider: 'Runware',
      features: ['image-inpainting'],
      tags: ['SmythOS', 'Other body parts'],
      enabled: true,
  },
  'smythos/person_yolov8n-seg': {
      label: 'Person YOLOv8n-seg',
      modelId: 'runware:35@4',
      provider: 'Runware',
      features: ['image-inpainting'],
      tags: ['SmythOS', 'Other body parts'],
      enabled: true,
  },
  'smythos/person_yolov8s-seg': {
      label: 'Person YOLOv8s-seg',
      modelId: 'runware:35@5',
      provider: 'Runware',
      features: ['image-inpainting'],
      tags: ['SmythOS', 'Other body parts'],
      enabled: true,

      credentials: 'internal',
  },
  // #endregion Runware Models

  // #region Retrocompatible Runware Models
  // TODO: Will be removed a few days later
  'flux.1-schnell': {
      label: 'FLUX.1 (Schnell)',
      modelId: 'runware:100@1',
      provider: 'Runware',
      features: ['image-generation'],
      tags: ['SmythOS'],
      enabled: false,

      credentials: 'vault',
  },
  'flux.1-dev': {
      label: 'FLUX.1 (Dev)',
      modelId: 'runware:101@1',
      provider: 'Runware',
      features: ['image-generation'],
      tags: ['SmythOS'],
      enabled: false,

      credentials: 'vault',
  },
  // #endregion Retrocompatible Runware Models

  // #endregion Image Generation Models ============================

  // xAI models
  grok: {
      llm: 'xAI',

      label: 'Grok',
      modelId: 'grok-2-latest',
      provider: 'xAI',
      features: ['text', 'tools'],
      tags: ['Personal', 'xAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      keyOptions: { tokens: 131_072, completionTokens: 8192, enabled: true },

      baseURL: 'https://api.x.ai/v1',

      credentials: 'vault',
  },
  'grok-2-vision': {
      llm: 'xAI',

      label: 'Grok Vision',
      modelId: 'grok-2-vision-latest',
      provider: 'xAI',
      features: ['image'],
      tags: ['New', 'Personal', 'xAI'],
      tokens: 0,
      completionTokens: 0,
      enabled: false,
      hidden: true,
      keyOptions: { tokens: 32_768, completionTokens: 32_768, enabled: true },

      baseURL: 'https://api.x.ai/v1',

      credentials: 'vault',
  },

  // #endregion [User Models] ==============================================================
};

/******************************************************
* ! DO NOT MODIFY THIS FILE INDEPENDENTLY
* ! TO ENSURE CONSISTENCY, THIS FILE IS SYNCED WITH
* ! THE APP AND SRE VERSIONS
******************************************************/
