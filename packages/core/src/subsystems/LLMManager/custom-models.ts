/**
 * Custom model configurations for various AI providers.
 * This template is useful for maintaining up-to-date model aliases and token information,
 * even though we store custom model data in the database.
 */

export const customModels = {
  //#region AI21 Labs Models
  'AI21 Labs - Jamba-Instruct': {
    alias: 'ai21.jamba-instruct-v1:0',
  },
  'ai21.jamba-instruct-v1:0': {
    llm: 'Bedrock',
    tokens: 256000,
    completionTokens: 4096,
    supportsSystemPrompt: true,
  },
  'AI21 Labs - Jurassic-2 Ultra': {
    alias: 'ai21.j2-ultra-v1',
  },
  'ai21.j2-ultra-v1': {
    llm: 'Bedrock',
    tokens: 8191,
    completionTokens: 8191,
    supportsSystemPrompt: false,
  },
  'AI21 Labs - Jurassic-2 Mid': {
    alias: 'ai21.j2-mid-v1',
  },
  'ai21.j2-mid-v1': {
    llm: 'Bedrock',
    tokens: 8191,
    completionTokens: 8191,
    supportsSystemPrompt: false,
  },
  //#region AI21 Labs Models

  //#region Amazon Models
  'Amazon - Titan Text Premier': {
    alias: 'amazon.titan-text-premier-v1:0',
  },
  'amazon.titan-text-premier-v1:0': {
    llm: 'Bedrock',
    tokens: 32000,
    completionTokens: 3000,
    supportsSystemPrompt: false,
  },
  'Amazon - Titan Text G1 - Express': {
    alias: 'amazon.titan-text-express-v1',
  },
  'amazon.titan-text-express-v1': {
    llm: 'Bedrock',
    tokens: 8192,
    completionTokens: 4096,
    supportsSystemPrompt: false,
  },
  'Amazon - Titan Text G1 - Lite': {
    alias: 'amazon.titan-text-lite-v1',
  },
  'amazon.titan-text-lite-v1': {
    llm: 'Bedrock',
    tokens: 4096,
    completionTokens: 4096,
    supportsSystemPrompt: false,
  },
  // 'Amazon - Titan Embeddings G1 - Text': { alias: 'amazon.titan-embed-text-v1' }, // Converse API doesn't support
  // 'Amazon - Titan Embedding Text v2': { alias: 'amazon.titan-embed-text-v2:0' }, // Converse API doesn't support
  // 'Amazon - Titan Multimodal Embeddings G1': { alias: 'amazon.titan-embed-image-v1' }, // Converse API doesn't support
  // 'Amazon - Titan Image Generator G1 V1': { alias: 'amazon.titan-image-generator-v1' }, // Converse API doesn't support
  // 'Amazon - Titan Image Generator G1 V2': { alias: 'amazon.titan-image-generator-v2:0' }, // Converse API doesn't support

  //#endregion Amazon Models

  //#region Anthropic Models
  // * NOTE: It's required to submit business info to get access for Anthropic models
  // * @Ref of Anthropic tokens and completionTokens - https://docs.anthropic.com/en/docs/about-claude/models
  'Anthropic - Claude 3.5 Sonnet': {
    alias: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
  },
  'anthropic.claude-3-5-sonnet-20240620-v1:0': {
    llm: 'Bedrock',
    tokens: 200000,
    completionTokens: 8192,
    supportsSystemPrompt: true,
  },
  'Anthropic - Claude 3 Sonnet': {
    alias: 'anthropic.claude-3-sonnet-20240229-v1:0',
  },
  'anthropic.claude-3-sonnet-20240229-v1:0': {
    llm: 'Bedrock',
    tokens: 200000,
    completionTokens: 4096,
    supportsSystemPrompt: true,
  },
  'Anthropic - Claude 3 Haiku': {
    alias: 'anthropic.claude-3-haiku-20240307-v1:0',
  },
  'anthropic.claude-3-haiku-20240307-v1:0': {
    llm: 'Bedrock',
    tokens: 200000,
    completionTokens: 4096,
    supportsSystemPrompt: true,
  },
  'Anthropic - Claude 3 Opus': {
    alias: 'anthropic.claude-3-opus-20240229-v1:0',
  },
  'anthropic.claude-3-opus-20240229-v1:0': {
    llm: 'Bedrock',
    tokens: 200000,
    completionTokens: 4096,
    supportsSystemPrompt: true,
  },
  'Anthropic - Claude 2.1': {
    alias: 'anthropic.claude-v2:1',
  },
  'anthropic.claude-v2:1': {
    llm: 'Bedrock',
    tokens: 200000,
    completionTokens: 4096,
    supportsSystemPrompt: true,
  },
  'Anthropic - Claude 2.0': {
    alias: 'anthropic.claude-v2',
  },
  'anthropic.claude-v2': {
    llm: 'Bedrock',
    tokens: 100000,
    completionTokens: 4096,
    supportsSystemPrompt: true,
  },
  'Anthropic - Claude Instant': {
    alias: 'anthropic.claude-instant-v1',
  },
  'anthropic.claude-instant-v1': {
    llm: 'Bedrock',
    tokens: 100000,
    completionTokens: 4096,
    supportsSystemPrompt: true,
  },
  //#endregion Anthropic Models

  //#region Cohere Models
  'Cohere - Command R+': {
    alias: 'cohere.command-r-plus-v1:0',
  },
  'cohere.command-r-plus-v1:0': {
    llm: 'Bedrock',
    tokens: 128000,
    completionTokens: 4000, // Found 4000 Max tokens in the Playground
    supportsSystemPrompt: true,
  },
  'Cohere - Command R': {
    alias: 'cohere.command-r-v1:0',
  },
  'cohere.command-r-v1:0': {
    llm: 'Bedrock',
    tokens: 128000,
    completionTokens: 4000, // Found 4000 Max tokens in the Playground
    supportsSystemPrompt: true,
  },
  'Cohere - Command': {
    alias: 'cohere.command-text-v14',
  },
  'cohere.command-text-v14': {
    llm: 'Bedrock',
    tokens: 4000, // Found 4k
    completionTokens: 4000, // Found 4000 Max tokens in the Playground
    supportsSystemPrompt: false,
  },
  'Cohere - Command Light': {
    alias: 'cohere.command-light-text-v14',
  },
  'cohere.command-light-text-v14': {
    llm: 'Bedrock',
    tokens: 4000, // 4k tokens
    completionTokens: 4000, // Found 4000 Max tokens in the Playground
    supportsSystemPrompt: false,
  },
  // 'Cohere - Embed English': { alias: 'cohere.embed-english-v3' }, // Converse API doesn't support
  // 'Cohere - Embed Multilingual': { alias: 'cohere.embed-multilingual-v3' }, // Converse API doesn't support
  //#endregion Cohere Models

  //#region Meta Models

  // 'Meta - Llama 2 Chat 13B' : { alias: 'meta.llama2-13b-chat-v1' } // Don't have access to the model
  // 'Meta - Llama 2 Chat 70B' : { alias: 'meta.llama2-70b-chat-v1' } // Don't have access to the model

  'Meta - Llama 3 8B Instruct': {
    alias: 'meta.llama3-8b-instruct-v1:0',
  },
  'meta.llama3-8b-instruct-v1:0': {
    llm: 'Bedrock',
    tokens: 8192,
    completionTokens: 2048,
    supportsSystemPrompt: true,
  },
  'Meta - Llama 3 70B Instruct': {
    alias: 'meta.llama3-70b-instruct-v1:0',
  },
  'meta.llama3-70b-instruct-v1:0': {
    llm: 'Bedrock',
    tokens: 8192,
    completionTokens: 2048,
    supportsSystemPrompt: true,
  },
  // 'Meta - Llama 3.1 8B Instruct': { alias: 'meta.llama3-1-8b-instruct-v1:0' }, // The provided model identifier is invalid.
  // 'Meta - Llama 3.1 70B Instruct': { alias: 'meta.llama3-1-70b-instruct-v1:0' }, // The provided model identifier is invalid.
  // 'Meta - Llama 3.1 405B Instruct': { alias: 'meta.llama3-1-405b-instruct-v1:0' }, // The provided model identifier is invalid.

  //#endregion Meta Models

  //#region Mistral Models
  'Mistral AI - Mistral 7B Instruct': {
    alias: 'mistral.mistral-7b-instruct-v0:2',
  },
  'mistral.mistral-7b-instruct-v0:2': {
    llm: 'Bedrock',
    tokens: 32000,
    completionTokens: 8192,
    supportsSystemPrompt: false,
  },
  'Mistral AI - Mixtral 8X7B Instruct': {
    alias: 'mistral.mixtral-8x7b-instruct-v0:1',
  },
  'mistral.mixtral-8x7b-instruct-v0:1': {
    llm: 'Bedrock',
    tokens: 32000,
    completionTokens: 4096,
    supportsSystemPrompt: false,
  },
  'Mistral AI - Mistral Large': {
    alias: 'mistral.mistral-large-2402-v1:0',
  },
  'mistral.mistral-large-2402-v1:0': {
    llm: 'Bedrock',
    tokens: 32000,
    completionTokens: 8192,
    supportsSystemPrompt: true,
  },
  // 'Mistral AI - Mistral Large 2 (24.07)' : { alias: 'mistral.mistral-large-2407-v1:0' } // The provided model identifier is invalid.
  'Mistral AI - Mistral Small': {
    alias: 'mistral.mistral-small-2402-v1:0',
  },
  'mistral.mistral-small-2402-v1:0': {
    llm: 'Bedrock',
    tokens: 32000,
    completionTokens: 8192,
    supportsSystemPrompt: true,
  },
  //#endregion Mistral Models

  //#region Stability Models
  // 'Stability AI - Stable Diffusion XL 0.x' : { alias: 'stability.stable-diffusion-xl-v0' } // Converse API doesn't support
  // 'Stability AI - Stable Diffusion XL 1.x' : { alias: 'stability.stable-diffusion-xl-v1' } // Converse API doesn't support
  //#endregion Stability Models
};
