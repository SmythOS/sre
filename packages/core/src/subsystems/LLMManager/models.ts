/******************************************************
 * ! DO NOT MODIFY THIS FILE INDEPENDENTLY
 * ! TO ENSURE CONSISTENCY, THIS FILE IS SYNCED WITH
 * ! THE FRONTEND AND BACKEND VERSIONS
 ******************************************************/

const MODEL_SCHEMA_VERSION: number = 2;
const isDev = process.env.NODE_ENV === 'DEV';

/**
 * * DEPRECATION NOTICE:
 * The following fields are being deprecated in favor of more semantic alternatives:
 *
 * - 'llm' -> 'provider'        : Use 'provider' to specify the LLM service provider
 * - 'alias' -> 'modelId'       : Use 'modelId' to specify the unique model identifier
 * - 'components' -> 'features' : Use 'features' to specify model capabilities
 *
 */

export const models = {
  Echo: {
    llm: 'Echo',
  },

  // #region [SmythOS Models] ==============================================================

  // #region OpenAI ==========================

  'smythos/gpt-4o-mini': {
    llm: 'OpenAI',

    label: 'GPT 4o mini',
    modelId: 'gpt-4o-mini-2024-07-18',
    provider: 'OpenAI',
    features: ['text', 'image'],
    tags: ['SmythOS'],
    tokens: 128_000,
    completionTokens: 16_383,
    enabled: true,
    hidden: MODEL_SCHEMA_VERSION !== 2 || !isDev,
  },
  'smythos/gpt-4o': {
    llm: 'OpenAI',

    label: 'GPT 4o',
    modelId: 'gpt-4o-2024-08-06',
    provider: 'OpenAI',
    features: ['text', 'image'],
    tags: ['SmythOS'],
    tokens: 128_000,
    completionTokens: 16_384,
    enabled: true,
    hidden: MODEL_SCHEMA_VERSION !== 2 || !isDev,
  },
  'smythos/o1': {
    llm: 'OpenAI',

    label: 'GPT o1',
    modelId: 'o1-2024-12-17',
    provider: 'OpenAI',
    features: ['text'],
    tags: ['SmythOS'],
    tokens: 200_000,
    completionTokens: 100_000,
    enabled: true,
    hidden: MODEL_SCHEMA_VERSION !== 2 || !isDev,
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
    hidden: MODEL_SCHEMA_VERSION !== 2 || !isDev,
  },

  // #endregion OpenAI ==========================

  // #region Anthropic ==========================

  'smythos/claude-3-5-sonnet': {
    llm: 'Anthropic',

    label: 'Claude 3.5 Sonnet',
    modelId: 'claude-3-5-sonnet-20240620',
    provider: 'Anthropic',
    features: ['text', 'image'],
    tags: ['SmythOS'],
    tokens: 200_000,
    completionTokens: 8_192,
    enabled: true,
    hidden: MODEL_SCHEMA_VERSION !== 2 || !isDev,
  },
  'smythos/claude-3.5-haiku': {
    llm: 'Anthropic',

    label: 'Claude 3.5 Haiku',
    modelId: 'claude-3-5-haiku-latest',
    provider: 'Anthropic',
    features: ['text'],
    tags: ['SmythOS'],
    tokens: 200_000,
    completionTokens: 8_192,
    enabled: true,
    hidden: MODEL_SCHEMA_VERSION !== 2 || !isDev,
  },

  // #endregion Anthropic ==========================

  // #region Google AI ==========================

  'smythos/gemini-2.0-flash': {
    label: 'Gemini 2.0 Flash Experimental',

    modelId: 'gemini-2.0-flash-exp',
    provider: 'GoogleAI',
    llm: 'GoogleAI',
    features: ['text', 'image'],
    tags: ['SmythOS'],
    tokens: 1_048_576,
    completionTokens: 8_192,
    enabled: true,
    hidden: MODEL_SCHEMA_VERSION !== 2 || !isDev,
  },
  'smythos/gemini-1.5-pro': {
    llm: 'GoogleAI',

    label: 'Gemini 1.5 Pro',
    modelId: 'gemini-1.5-pro',
    provider: 'GoogleAI',
    features: ['text'],
    tags: ['SmythOS'],
    tokens: 2_097_152,
    completionTokens: 8_192,
    enabled: true,
    hidden: MODEL_SCHEMA_VERSION !== 2 || !isDev,
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
  },

  // #endregion Groq ==========================

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
  },
  'deepseek-chat': {
    llm: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/beta',
    tokens: 128000,
    completionTokens: 8192,
    enabled: false,
    keyOptions: { tokens: 128_000, completionTokens: 8192 },
  },

  // #endregion DeepSeek ==========================

  // #region OpenAI Models ==========================

  // #region GPT 4o
  'gpt-4o-mini': {
    llm: 'OpenAI',
    alias: 'gpt-4o-mini-2024-07-18',
    components: [
      'PromptGenerator',
      'LLMAssistant',
      'Classifier',
      'VisionLLM',
      'AgentPlugin',
      'Chatbot',
      'GPTPlugin',
      'GenAILLM',
    ],

    label: 'GPT 4o mini',
    modelId: 'gpt-4o-mini-2024-07-18',
    provider: 'OpenAI',
    features: ['text', 'image'],
    tags: ['Personal'],
    tokens: 0,
    completionTokens: 0,
    enabled: true,
    keyOptions: { tokens: 128_000, completionTokens: 16_383, enabled: true },
  },
  'gpt-4o-mini-2024-07-18': {
    llm: 'OpenAI',
    tokens: 2048,
    completionTokens: 2048,
    enabled: true,
    keyOptions: { tokens: 128000, completionTokens: 16383 },
  },
  'gpt-4o': {
    llm: 'OpenAI',
    alias: 'gpt-4o-2024-08-06',
    components: [
      'PromptGenerator',
      'LLMAssistant',
      'Classifier',
      'VisionLLM',
      'AgentPlugin',
      'Chatbot',
      'GPTPlugin',
      'GenAILLM',
    ],

    label: 'GPT 4o',
    modelId: 'gpt-4o-2024-08-06',
    provider: 'OpenAI',
    features: ['text', 'image'],
    tags: ['Personal'],
    tokens: 0,
    completionTokens: 0,
    enabled: true,
    keyOptions: { tokens: 128_000, completionTokens: 16_384, enabled: true },
  },
  'gpt-4o-2024-08-06': {
    llm: 'OpenAI',
    tokens: 2048,
    completionTokens: 2048,
    enabled: true,
    keyOptions: { tokens: 128000, completionTokens: 16384 },
  },
  // #endregion GPT 4o

  // #region o1 models
  'o3-mini': {
    llm: 'OpenAI',
    alias: 'o3-mini-2025-01-31',
    components: ['PromptGenerator', 'GenAILLM'],

    label: 'GPT o3 mini',
    modelId: 'o3-mini-2025-01-31',
    provider: 'OpenAI',
    features: ['text'],
    tags: ['New', 'Personal'],
    tokens: 0,
    completionTokens: 0,
    enabled: true,
    keyOptions: { tokens: 200_000, completionTokens: 100_000, enabled: true },
  },
  o1: {
    llm: 'OpenAI',
    alias: 'o1-2024-12-17',
    components: ['PromptGenerator', 'GenAILLM'],

    label: 'GPT o1',
    modelId: 'o1-2024-12-17',
    provider: 'OpenAI',
    features: ['text'],
    tags: ['New', 'Personal'],
    tokens: 0,
    completionTokens: 0,
    enabled: true,
    keyOptions: { tokens: 200_000, completionTokens: 100_000, enabled: true },
  },
  'o1-2024-12-17': {
    llm: 'OpenAI',
    tokens: 2048,
    completionTokens: 2048,
    enabled: true,
    keyOptions: { tokens: 200_000, completionTokens: 100_000 },
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
    enabled: true,
    keyOptions: { tokens: 128_000, completionTokens: 65_536, enabled: true },
  },
  'o1-mini-2024-09-12': {
    llm: 'OpenAI',
    tokens: 2048,
    completionTokens: 2048,
    enabled: true,
    keyOptions: { tokens: 128_000, completionTokens: 65_536 },
  },
  'o1-preview': {
    llm: 'OpenAI',
    alias: 'o1-preview-2024-09-12',
    components: ['PromptGenerator', 'GenAILLM'],

    label: 'GPT o1 Preview',
    modelId: 'o1-preview-2024-09-12',
    provider: 'OpenAI',
    features: ['text'],
    tags: ['New', 'Personal'],
    tokens: 0,
    completionTokens: 0,
    enabled: true,
    keyOptions: { tokens: 128_000, completionTokens: 32_768, enabled: true },
  },
  'o1-preview-2024-09-12': {
    llm: 'OpenAI',
    tokens: 2048,
    completionTokens: 2048,
    enabled: true,
    keyOptions: { tokens: 128_000, completionTokens: 32_768 },
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
    features: ['text'],
    tags: ['Personal', 'legacy'],
    tokens: 0,
    completionTokens: 0,
    enabled: true,
    keyOptions: { tokens: 128_000, completionTokens: 4096, enabled: true },
  },
  'gpt-4-turbo': {
    llm: 'OpenAI',
    alias: 'gpt-4-turbo-2024-04-09',
    components: [
      'PromptGenerator',
      'LLMAssistant',
      'VisionLLM',
      'GPTPlugin',
      'AgentPlugin',
      'Chatbot',
    ],

    label: 'GPT 4 Turbo',
    modelId: 'gpt-4-turbo-2024-04-09',
    provider: 'OpenAI',
    features: ['text', 'image'],
    tags: ['Personal', 'legacy'],
    tokens: 0,
    completionTokens: 0,
    enabled: true,
    keyOptions: { tokens: 128_000, completionTokens: 4096, enabled: true },
  },
  'gpt-4-turbo-2024-04-09': {
    llm: 'OpenAI',
    tokens: 2048,
    completionTokens: 2048,
    enabled: true,
    keyOptions: { tokens: 128000, completionTokens: 4096 },
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
    features: ['text'],
    tags: ['Personal', 'legacy'],
    tokens: 0,
    completionTokens: 0,
    enabled: true,
    keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
  },
  'gpt-4': {
    llm: 'OpenAI',
    components: [
      'PromptGenerator',
      'LLMAssistant',
      'Classifier',
      'GPTPlugin',
      'AgentPlugin',
      'Chatbot',
    ],

    label: 'GPT 4',
    modelId: 'gpt-4-0613',
    provider: 'OpenAI',
    features: ['text'],
    tags: ['Personal', 'legacy'],
    tokens: 0,
    completionTokens: 0,
    enabled: true,
    keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
  },
  'gpt-4-0613': {
    llm: 'OpenAI',
    tokens: 2048,
    completionTokens: 2048,
    enabled: true,
    hidden: true,
    keyOptions: { tokens: 8192, completionTokens: 8192 },
  },
  // #endregion GPT-4

  // #region GPT-3.5
  'gpt-3.5-turbo-latest': {
    llm: 'OpenAI',
    alias: 'gpt-3.5-turbo-0125',
    components: [
      'PromptGenerator',
      'LLMAssistant',
      'Classifier',
      'GPTPlugin',
      'AgentPlugin',
      'Chatbot',
    ],

    label: 'GPT 3.5 Turbo Latest',
    modelId: 'gpt-3.5-turbo-0125',
    provider: 'OpenAI',
    features: ['text'],
    tags: ['Personal', 'legacy'],
    tokens: 0,
    completionTokens: 0,
    enabled: true,
    keyOptions: { tokens: 16385, completionTokens: 4096, enabled: true },
  },
  'gpt-3.5-turbo': {
    llm: 'OpenAI',
    alias: 'gpt-3.5-turbo-0125',
    components: [
      'PromptGenerator',
      'LLMAssistant',
      'Classifier',
      'GPTPlugin',
      'AgentPlugin',
      'Chatbot',
    ],

    label: 'GPT 3.5 Turbo',
    modelId: 'gpt-3.5-turbo-0125',
    provider: 'OpenAI',
    features: ['text'],
    tags: ['Personal', 'legacy'],
    tokens: 0,
    completionTokens: 0,
    enabled: true,
    keyOptions: { tokens: 16385, completionTokens: 4096, enabled: true },
  },
  'gpt-3.5-turbo-0125': {
    llm: 'OpenAI',
    tokens: 2048,
    completionTokens: 2048,
    enabled: true,
    keyOptions: { tokens: 16385, completionTokens: 4096 },
  },
  // #endregion GPT-3.5

  // #endregion OpenAI Models ==========================

  // #region Anthropic Models ==========================

  'claude-3.5-haiku': {
    llm: 'Anthropic',
    alias: 'claude-3-5-haiku-latest',
    components: [
      'PromptGenerator',
      'LLMAssistant',
      'Classifier',
      'AgentPlugin',
      'Chatbot',
      'GenAILLM',
    ],

    label: 'Claude 3.5 Haiku',
    modelId: 'claude-3-5-haiku-latest',
    provider: 'Anthropic',
    features: ['text'],
    tags: ['New', 'Personal'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 200_000, completionTokens: 8192, enabled: true },
  },
  'claude-3-5-haiku-latest': {
    llm: 'Anthropic',
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 200000, completionTokens: 8192, enabled: true },
  },
  'claude-3-5-sonnet-latest': {
    llm: 'Anthropic',
    components: [
      'PromptGenerator',
      'LLMAssistant',
      'Classifier',
      'VisionLLM',
      'AgentPlugin',
      'Chatbot',
      'GenAILLM',
    ],

    label: 'Claude 3.5 Sonnet',
    modelId: 'claude-3-5-sonnet-latest',
    provider: 'Anthropic',
    features: ['text', 'image'],
    tags: ['Personal'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 200_000, completionTokens: 8192, enabled: true },
  },
  'claude-3.5-sonnet': {
    llm: 'Anthropic',
    alias: 'claude-3-5-sonnet-20240620',
    components: [
      'PromptGenerator',
      'LLMAssistant',
      'Classifier',
      'VisionLLM',
      'AgentPlugin',
      'Chatbot',
      'GenAILLM',
    ],

    label: 'Claude 3.5 Sonnet',
    modelId: 'claude-3-5-sonnet-20240620',
    provider: 'Anthropic',
    features: ['text', 'image'],
    tags: ['Personal'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 200_000, completionTokens: 8192, enabled: true },
  },
  'claude-3-5-sonnet-20240620': {
    llm: 'Anthropic',
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 200000, completionTokens: 8192, enabled: true },
  },
  'claude-3-opus': {
    llm: 'Anthropic',
    alias: 'claude-3-opus-20240229',
    components: [
      'PromptGenerator',
      'LLMAssistant',
      'Classifier',
      'VisionLLM',
      'AgentPlugin',
      'Chatbot',
      'GenAILLM',
    ],

    label: 'Claude 3 Opus',
    modelId: 'claude-3-opus-20240229',
    provider: 'Anthropic',
    features: ['text', 'image'],
    tags: ['Personal'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 200_000, completionTokens: 4096, enabled: true },
  },
  'claude-3-opus-20240229': {
    llm: 'Anthropic',
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 200000, completionTokens: 4096, enabled: true },
  },
  'claude-3-sonnet': {
    llm: 'Anthropic',
    alias: 'claude-3-sonnet-20240229',
    components: [
      'PromptGenerator',
      'LLMAssistant',
      'Classifier',
      'VisionLLM',
      'AgentPlugin',
      'Chatbot',
    ],

    label: 'Claude 3 Sonnet',
    modelId: 'claude-3-sonnet-20240229',
    provider: 'Anthropic',
    features: ['text', 'image'],
    tags: ['Personal', 'deprecated'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 200_000, completionTokens: 4096, enabled: true },
  },
  'claude-3-sonnet-20240229': {
    llm: 'Anthropic',
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 200000, completionTokens: 4096, enabled: true },
  },
  'claude-3-haiku': {
    llm: 'Anthropic',
    alias: 'claude-3-haiku-20240307',
    components: [
      'PromptGenerator',
      'LLMAssistant',
      'Classifier',
      'VisionLLM',
      'AgentPlugin',
      'Chatbot',
    ],

    label: 'Claude 3 Haiku',
    modelId: 'claude-3-haiku-20240307',
    provider: 'Anthropic',
    features: ['text', 'image'],
    tags: ['Personal', 'legacy'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 200_000, completionTokens: 4096, enabled: true },
  },
  'claude-3-haiku-20240307': {
    llm: 'Anthropic',
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 200000, completionTokens: 4096, enabled: true },
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
  },

  // #endregion Anthropic Models ==========================

  // #region Google AI Models ==========================

  // #region Gemini 2.0 flash
  'gemini-2.0-flash': {
    llm: 'GoogleAI',
    components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'MultimodalLLM'],

    label: 'Gemini 2.0 Flash Experimental',
    modelId: 'gemini-2.0-flash-exp',
    provider: 'GoogleAI',
    features: ['text', 'image'],
    tags: ['Personal'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 1_048_576, completionTokens: 8_192, enabled: true },
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
    tags: ['Personal', 'legacy'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 2_097_152, completionTokens: 8192, enabled: true },
  },
  'gemini-1.5-pro-latest-stable': {
    llm: 'GoogleAI',
    alias: 'gemini-1.5-pro',
    components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'MultimodalLLM', 'GenAILLM'],

    label: 'Gemini 1.5 Pro Latest Stable',
    modelId: 'gemini-1.5-pro',
    provider: 'GoogleAI',
    features: ['text', 'image', 'audio', 'video', 'document'],
    tags: ['Personal'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 2_097_152, completionTokens: 8192, enabled: true },
  },
  'gemini-1.5-pro-latest': {
    llm: 'GoogleAI',
    components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'MultimodalLLM'],

    label: 'Gemini 1.5 Pro',
    modelId: 'gemini-1.5-pro',
    provider: 'GoogleAI',
    tags: ['Personal', 'legacy'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 2_097_152, completionTokens: 8_192, enabled: true },
  },
  'gemini-1.5-pro-stable': {
    llm: 'GoogleAI',
    alias: 'gemini-1.5-pro-001',
    components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'MultimodalLLM', 'GenAILLM'],

    label: 'Gemini 1.5 Pro Stable',
    modelId: 'gemini-1.5-pro',
    provider: 'GoogleAI',
    features: ['text', 'image', 'audio', 'video', 'document'],
    tags: ['Personal'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 2_097_152, completionTokens: 8192, enabled: true },
  },
  'gemini-1.5-pro': {
    llm: 'GoogleAI',
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 2097152, completionTokens: 8192, enabled: true },
  },
  'gemini-1.5-pro-001': {
    llm: 'GoogleAI',
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 2097152, completionTokens: 8192, enabled: true },
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
    tags: ['Personal', 'legacy'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 1_048_576, completionTokens: 8192, enabled: true },
  },
  'gemini-1.5-flash-latest-stable': {
    llm: 'GoogleAI',
    alias: 'gemini-1.5-flash',
    components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'MultimodalLLM'],

    label: 'Gemini 1.5 Flash Latest Stable',
    modelId: 'gemini-1.5-flash',
    provider: 'GoogleAI',
    features: ['text', 'image', 'audio', 'video', 'document'],
    tags: ['Personal', 'legacy'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 1_048_576, completionTokens: 8192, enabled: true },
  },
  'gemini-1.5-flash-stable': {
    llm: 'GoogleAI',
    alias: 'gemini-1.5-flash-001',
    components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'MultimodalLLM', 'GenAILLM'],

    label: 'Gemini 1.5 Flash Stable',
    modelId: 'gemini-1.5-flash-001',
    provider: 'GoogleAI',
    features: ['text', 'image', 'audio', 'video', 'document'],
    tags: ['Personal'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 1_048_576, completionTokens: 8192, enabled: true },
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
  },
  'gemini-1.0-pro': {
    llm: 'GoogleAI',
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 30_720, completionTokens: 8192, enabled: true },
  },
  'gemini-1.0-pro-001': {
    llm: 'GoogleAI',
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 30_720, completionTokens: 8192, enabled: true },
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
    tags: ['New', 'Personal', 'Groq'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 128_000, completionTokens: 32_768, enabled: true },
  },
  'groq-llama3-70b': {
    llm: 'Groq',
    alias: 'llama3-70b-8192',
    components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

    label: 'Meta - Llama 3 70B',
    modelId: 'llama3-70b-8192',
    provider: 'Groq',
    features: ['text'],
    tags: ['New', 'Personal', 'Groq'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
  },
  'llama3-70b-8192': {
    llm: 'Groq',
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
  },
  'groq-llama-3.1-8b-instant': {
    llm: 'Groq',
    alias: 'llama-3.1-8b-instant',
    components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

    label: 'Meta - Llama 3.1 8B',
    modelId: 'llama-3.1-8b-instant',
    provider: 'Groq',
    features: ['text'],
    tags: ['New', 'Personal', 'Groq'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 128_000, completionTokens: 8192, enabled: true },
  },
  'llama-3.1-8b-instant': {
    llm: 'Groq',
    tokens: 8000,
    completionTokens: 8000,
    enabled: false,
    keyOptions: { tokens: 131072, completionTokens: 8192, enabled: true },
  },
  'llama-guard-3-8b': {
    llm: 'Groq',
    components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

    label: 'Meta - Llama Guard 3 8B',
    modelId: 'llama-guard-3-8b',
    provider: 'Groq',
    features: ['text'],
    tags: ['New', 'Personal', 'Groq'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
  },
  'groq-llama3-8b': {
    llm: 'Groq',
    alias: 'llama3-8b-8192',
    components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

    label: 'Meta - Llama 3 8B',
    modelId: 'llama3-8b-8192',
    provider: 'Groq',
    features: ['text'],
    tags: ['New', 'Personal', 'Groq'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
  },
  'llama3-8b-8192': {
    llm: 'Groq',
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
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
  },
  'gemma2-9b-it': {
    llm: 'Groq',
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
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
  },
  'mixtral-8x7b-32768': {
    llm: 'Groq',
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 32768, completionTokens: 32768, enabled: true },
  },
  // #endregion Groq - Production Models

  // #region Groq - Preview Models
  'deepseek-r1-distill-llama-70b': {
    llm: 'Groq',

    label: 'DeepSeek - R1 Distill Llama 70b Preview',
    modelId: 'deepseek-r1-distill-llama-70b',
    provider: 'Groq',
    features: ['text'],
    tags: ['New', 'Personal', 'Groq'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 128_000, completionTokens: 8192, enabled: true },
  },
  'llama-3.3-70b-specdec': {
    llm: 'Groq',

    label: 'Meta - Llama 3.3 70B SpecDec Preview',
    modelId: 'llama-3.3-70b-specdec',
    provider: 'Groq',
    features: ['text'],
    tags: ['New', 'Personal', 'Groq'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
  },
  'llama-3.2-1b-preview': {
    llm: 'Groq',
    components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

    label: 'Meta - Llama 3.2 1B Preview',
    modelId: 'llama-3.2-1b-preview',
    provider: 'Groq',
    features: ['text'],
    tags: ['New', 'Personal', 'Groq'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 128_000, completionTokens: 8192, enabled: true },
  },
  'llama-3.2-3b-preview': {
    llm: 'Groq',
    components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

    label: 'Meta - Llama 3.2 3B Preview',
    modelId: 'llama-3.2-3b-preview',
    provider: 'Groq',
    features: ['text'],
    tags: ['New', 'Personal', 'Groq'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 128_000, completionTokens: 8192, enabled: true },
  },
  'llama-3.2-11b-vision-preview': {
    llm: 'Groq',
    components: ['PromptGenerator', 'LLMAssistant', 'VisionLLM', 'GenAILLM'],

    label: 'Meta - Llama 3.2 11B Vision Preview',
    modelId: 'llama-3.2-11b-vision-preview',
    provider: 'Groq',
    features: ['text', 'image'],
    tags: ['New', 'Personal', 'Groq'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 128_000, completionTokens: 8192, enabled: true },
  },
  'llama-3.2-90b-vision-preview': {
    llm: 'Groq',

    label: 'Meta - Llama 3.2 90b Vision Preview',
    modelId: 'llama-3.2-90b-vision-preview',
    provider: 'Groq',
    features: ['text', 'image'],
    tags: ['New', 'Personal', 'Groq'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 128_000, completionTokens: 8192, enabled: true },
  },
  // #endregion Groq - Preview Models

  // #endregion Groq Models ==========================

  // #region Together AI Models ==========================

  // #region Together AI - DeepSeek
  'deepseek-ai/DeepSeek-R1': {
    llm: 'TogetherAI',

    label: 'DeepSeek - R1',
    modelId: 'deepseek-ai/DeepSeek-R1',
    provider: 'TogetherAI',
    features: ['text'],
    tags: ['New', 'Personal', 'TogetherAI'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 163_840, completionTokens: 32_768, enabled: true },

    baseURL: 'https://api.together.xyz/v1',
  },
  'deepseek-ai/DeepSeek-V3': {
    llm: 'TogetherAI',

    label: 'DeepSeek - V3',
    modelId: 'deepseek-ai/DeepSeek-V3',
    provider: 'TogetherAI',
    features: ['text'],
    tags: ['New', 'Personal', 'TogetherAI'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 131_072, completionTokens: 8192, enabled: true },

    baseURL: 'https://api.together.xyz/v1',
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
  },
  // #endregion Together AI - DeepSeek

  // #region Together AI - Meta
  'meta-llama/Llama-3.3-70B-Instruct-Turbo': {
    llm: 'TogetherAI',

    label: 'Meta - Llama 3.3 70B Instruct Turbo',
    modelId: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    provider: 'TogetherAI',
    features: ['text'],
    tags: ['New', 'Personal', 'TogetherAI'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 131_072, completionTokens: 32_768, enabled: true },

    baseURL: 'https://api.together.xyz/v1',
  },
  'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo': {
    llm: 'TogetherAI',
    components: ['LLMAssistant', 'PromptGenerator', 'GenAILLM'],

    label: 'Meta - Llama 3.1 8B Instruct Turbo',
    modelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    provider: 'TogetherAI',
    features: ['text'],
    tags: ['Personal', 'TogetherAI'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 131_072, completionTokens: 32_768, enabled: true },

    baseURL: 'https://api.together.xyz/v1',
  },
  'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo': {
    llm: 'TogetherAI',
    components: ['LLMAssistant', 'PromptGenerator', 'GenAILLM'],

    label: 'Meta - Llama 3.1 70B Instruct Turbo',
    modelId: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    provider: 'TogetherAI',
    features: ['text'],
    tags: ['Personal', 'TogetherAI'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 131_072, completionTokens: 32_768, enabled: true },

    baseURL: 'https://api.together.xyz/v1',
  },
  'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo': {
    llm: 'TogetherAI',
    components: ['LLMAssistant', 'PromptGenerator', 'GenAILLM'],

    label: 'Meta - Llama 3.1 405B Instruct Turbo',
    modelId: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
    provider: 'TogetherAI',
    features: ['text'],
    tags: ['Personal', 'TogetherAI'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 130_815, completionTokens: 32_768, enabled: true },

    baseURL: 'https://api.together.xyz/v1',
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
  },
  'mistralai/Mistral-7B-Instruct-v0.1': {
    llm: 'TogetherAI',
    components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

    label: 'Mistral - 7B Instruct v0.1',
    modelId: 'mistralai/Mistral-7B-Instruct-v0.1',
    provider: 'TogetherAI',
    features: ['text'],
    tags: ['Personal', 'TogetherAI'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },

    baseURL: 'https://api.together.xyz/v1',
  },
  'mistralai/Mixtral-8x7B-Instruct-v0.1': {
    llm: 'TogetherAI',
    components: ['PromptGenerator', 'LLMAssistant', 'Classifier', 'GenAILLM'],

    label: 'Mistral - 8x7B Instruct v0.1',
    modelId: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    provider: 'TogetherAI',
    features: ['text'],
    tags: ['Personal', 'TogetherAI'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 32_768, completionTokens: 32_768, enabled: true },

    baseURL: 'https://api.together.xyz/v1',
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
  },
  'Qwen/Qwen2.5-7B-Instruct-Turbo': {
    llm: 'TogetherAI',

    label: 'Qwen - 2.5 7B Instruct Turbo',
    modelId: 'Qwen/Qwen2.5-7B-Instruct-Turbo',
    provider: 'TogetherAI',
    features: ['text'],
    tags: ['New', 'Personal', 'TogetherAI'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 32_768, completionTokens: 32_768, enabled: true },

    baseURL: 'https://api.together.xyz/v1',
  },
  'Qwen/Qwen2.5-72B-Instruct-Turbo': {
    llm: 'TogetherAI',

    label: 'Qwen - 2.5 72B Instruct Turbo',
    modelId: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
    provider: 'TogetherAI',
    features: ['text'],
    tags: ['New', 'Personal', 'TogetherAI'],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 32_768, completionTokens: 32_768, enabled: true },

    baseURL: 'https://api.together.xyz/v1',
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
  },
  // #endregion Together AI - Gryphe

  // #endregion Together AI Models ==========================

  // We do not get the exact token information for Dalle models, so use the maximum possible values
  'dall-e-3': {
    llm: 'OpenAI',
    alias: 'dall-e-3',
    components: ['ImageGenerator'],

    label: 'OpenAI - Dall-E 3',
    modelId: 'dall-e-3',
    provider: 'OpenAI',
    features: ['image'],
    tags: ['Personal', 'OpenAI'],
    tokens: 0,
    completionTokens: 0,
    enabled: true,
    keyOptions: { tokens: 128000, completionTokens: 16383 },
  },
  'dall-e-2': {
    llm: 'OpenAI',
    alias: 'dall-e-2',
    components: ['ImageGenerator'],

    label: 'OpenAI - Dall-E 2',
    modelId: 'dall-e-2',
    provider: 'OpenAI',
    features: ['image'],
    tags: ['Personal', 'OpenAI'],
    tokens: 0,
    completionTokens: 0,
    enabled: true,
    keyOptions: { tokens: 128000, completionTokens: 16383 },
  },

  // xAI models
  grok: {
    llm: 'xAI',
    alias: 'grok-beta',
    components: ['PromptGenerator', 'LLMAssistant', 'GenAILLM'],

    label: 'xAI - Grok',
    modelId: 'grok-beta',
    provider: 'xAI',
    features: ['text'],
    tags: [],
    tokens: 0,
    completionTokens: 0,
    enabled: false,
    keyOptions: { tokens: 131072, completionTokens: 4096, enabled: true },

    baseURL: 'https://api.x.ai/v1',
  },
  'grok-beta': {
    llm: 'xAI',
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: {
      tokens: 131072,
      completionTokens: 4096, // assumed
      enabled: true,
    },
    baseURL: 'https://api.x.ai/v1',
  },

  // #endregion [User Models] ==============================================================
};

/******************************************************
 * ! DO NOT MODIFY THIS FILE INDEPENDENTLY
 * ! TO ENSURE CONSISTENCY, THIS FILE IS SYNCED WITH
 * ! THE FRONTEND AND BACKEND VERSIONS
 ******************************************************/
