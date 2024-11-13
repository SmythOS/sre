/**
 * Custom model configurations for various AI providers.
 * This template is useful for maintaining up-to-date model aliases and token information,
 * even though we store custom model data in the database.
 */

export const customModels = {
  /**************************************************
   * AWS Bedrock Models
   **************************************************/

  /*
   Context token information sourced from the AWS Bedrock Console:
   https://us-east-1.console.aws.amazon.com/bedrock/home?region=us-east-1#/overview
   
   Completion token information sourced from the AWS Bedrock Text Playground:
   https://us-east-1.console.aws.amazon.com/bedrock/home?region=us-east-1#/text-playground

   Supported model features information sourced from - https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-supported-models-features.html
   */

  //#region AI21 Labs Models
  'ai21.jamba-instruct-v1:0': {
    llm: 'Bedrock',
    label: 'AI21 Labs - Jamba-Instruct',
    tokens: 256000,
    completionTokens: 4096,
    supportsSystemPrompt: true,
  },
  'ai21.j2-ultra-v1': {
    llm: 'Bedrock',
    label: 'AI21 Labs - Jurassic-2 Ultra',
    tokens: 8191,
    completionTokens: 8191,
    supportsSystemPrompt: false,
  },
  'ai21.j2-mid-v1': {
    llm: 'Bedrock',
    label: 'AI21 Labs - Jurassic-2 Mid',
    tokens: 8191,
    completionTokens: 8191,
    supportsSystemPrompt: false,
  },
  //#endregion AI21 Labs Models

  //#region Amazon Models
  'amazon.titan-text-premier-v1:0': {
    llm: 'Bedrock',
    label: 'Amazon - Titan Text Premier',
    tokens: 32000,
    completionTokens: 3000,
    supportsSystemPrompt: false,
  },
  'amazon.titan-text-express-v1': {
    llm: 'Bedrock',
    label: 'Amazon - Titan Text G1 - Express',
    tokens: 8192,
    completionTokens: 4096,
    supportsSystemPrompt: false,
  },
  'amazon.titan-text-lite-v1': {
    llm: 'Bedrock',
    label: 'Amazon - Titan Text G1 - Lite',
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
  'us.anthropic.claude-3-5-haiku-20241022-v1:0': {
    llm: 'Bedrock',
    label: 'Anthropic - Claude 3.5 Haiku',
    tokens: 200000,
    completionTokens: 8192,
    supportsSystemPrompt: true,
    tags: ['v1:0', 'new'],
  },
  'us.anthropic.claude-3-5-sonnet-20241022-v2:0': {
    llm: 'Bedrock',
    label: 'Anthropic - Claude 3.5 Sonnet',
    tokens: 200000,
    completionTokens: 8192,
    supportsSystemPrompt: true,
    tags: ['v2:0', 'new'],
  },
  'anthropic.claude-3-5-sonnet-20240620-v1:0': {
    llm: 'Bedrock',
    label: 'Anthropic - Claude 3.5 Sonnet',
    tokens: 200000,
    completionTokens: 8192,
    supportsSystemPrompt: true,
    tags: ['v1:0'],
  },
  'anthropic.claude-3-sonnet-20240229-v1:0': {
    llm: 'Bedrock',
    label: 'Anthropic - Claude 3 Sonnet',
    tokens: 200000,
    completionTokens: 4096,
    supportsSystemPrompt: true,
  },
  'anthropic.claude-3-haiku-20240307-v1:0': {
    llm: 'Bedrock',
    label: 'Anthropic - Claude 3 Haiku',
    tokens: 200000,
    completionTokens: 4096,
    supportsSystemPrompt: true,
  },
  'anthropic.claude-3-opus-20240229-v1:0': {
    llm: 'Bedrock',
    label: 'Anthropic - Claude 3 Opus',
    tokens: 200000,
    completionTokens: 4096,
    supportsSystemPrompt: true,
  },
  'anthropic.claude-v2:1': {
    llm: 'Bedrock',
    label: 'Anthropic - Claude 2.1',
    tokens: 200000,
    completionTokens: 4096,
    supportsSystemPrompt: true,
  },
  'anthropic.claude-v2': {
    llm: 'Bedrock',
    label: 'Anthropic - Claude 2.0',
    tokens: 100000,
    completionTokens: 4096,
    supportsSystemPrompt: true,
  },
  'anthropic.claude-instant-v1': {
    llm: 'Bedrock',
    label: 'Anthropic - Claude Instant',
    tokens: 100000,
    completionTokens: 4096,
    supportsSystemPrompt: true,
  },
  //#endregion Anthropic Models

  //#region Cohere Models
  'cohere.command-r-plus-v1:0': {
    llm: 'Bedrock',
    label: 'Cohere - Command R+',
    tokens: 128000,
    completionTokens: 4000, // Found 4000 Max tokens in the Playground
    supportsSystemPrompt: true,
  },
  'cohere.command-r-v1:0': {
    llm: 'Bedrock',
    label: 'Cohere - Command R',
    tokens: 128000,
    completionTokens: 4000, // Found 4000 Max tokens in the Playground
    supportsSystemPrompt: true,
  },
  'cohere.command-text-v14': {
    llm: 'Bedrock',
    label: 'Cohere - Command',
    tokens: 4000, // Found 4k
    completionTokens: 4000, // Found 4000 Max tokens in the Playground
    supportsSystemPrompt: false,
  },
  'cohere.command-light-text-v14': {
    llm: 'Bedrock',
    label: 'Cohere - Command Light',
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
  'meta.llama3-8b-instruct-v1:0': {
    llm: 'Bedrock',
    label: 'Meta - Llama 3 8B Instruct',
    tokens: 8192,
    completionTokens: 2048,
    supportsSystemPrompt: true,
  },
  'meta.llama3-70b-instruct-v1:0': {
    llm: 'Bedrock',
    label: 'Meta - Llama 3 70B Instruct',
    tokens: 8192,
    completionTokens: 2048,
    supportsSystemPrompt: true,
  },
  // 'Meta - Llama 3.1 8B Instruct': { alias: 'meta.llama3-1-8b-instruct-v1:0' }, // The provided model identifier is invalid.
  // 'Meta - Llama 3.1 70B Instruct': { alias: 'meta.llama3-1-70b-instruct-v1:0' }, // The provided model identifier is invalid.
  // 'Meta - Llama 3.1 405B Instruct': { alias: 'meta.llama3-1-405b-instruct-v1:0' }, // The provided model identifier is invalid.

  //#endregion Meta Models

  //#region Mistral Models
  'mistral.mistral-7b-instruct-v0:2': {
    llm: 'Bedrock',
    label: 'Mistral AI - Mistral 7B Instruct',
    tokens: 32000,
    completionTokens: 8192,
    supportsSystemPrompt: false,
  },
  'mistral.mixtral-8x7b-instruct-v0:1': {
    llm: 'Bedrock',
    label: 'Mistral AI - Mixtral 8X7B Instruct',
    tokens: 32000,
    completionTokens: 4096,
    supportsSystemPrompt: false,
  },
  'mistral.mistral-large-2402-v1:0': {
    llm: 'Bedrock',
    label: 'Mistral AI - Mistral Large',
    tokens: 32000,
    completionTokens: 8192,
    supportsSystemPrompt: true,
  },
  // 'Mistral AI - Mistral Large 2 (24.07)' : { alias: 'mistral.mistral-large-2407-v1:0' } // The provided model identifier is invalid.
  'mistral.mistral-small-2402-v1:0': {
    llm: 'Bedrock',
    label: 'Mistral AI - Mistral Small',
    tokens: 32000,
    completionTokens: 8192,
    supportsSystemPrompt: true,
  },
  //#endregion Mistral Models

  //#region Stability Models
  // 'Stability AI - Stable Diffusion XL 0.x' : { alias: 'stability.stable-diffusion-xl-v0' } // Converse API doesn't support
  // 'Stability AI - Stable Diffusion XL 1.x' : { alias: 'stability.stable-diffusion-xl-v1' } // Converse API doesn't support
  //#endregion Stability Models

  /**************************************************
   * Vertex AI Models
   **************************************************/

  /*
   Context token information sourced from :
   Vertex AI documentation - https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models
   Anthropic - https://docs.anthropic.com/en/docs/about-claude/models
   
   Completion token information sourced from:
   Vertex AI Text Playground - https://console.cloud.google.com/vertex-ai/generative/language/create/text?model=text-bison@001&authuser=1&project=opt-smythos-vertexia-432522
   */

  'gemini-1.5-flash': {
    llm: 'VertexAI',
    label: 'Gemini 1.5 Flash',
    supportsSystemPrompt: true,
    tokens: 1048576,
    completionTokens: 8192,
  },
  'gemini-1.5-pro': {
    llm: 'VertexAI',
    label: 'Gemini 1.5 Pro',
    supportsSystemPrompt: true,
    tokens: 2097152,
    completionTokens: 8192,
  },
  'gemini-1.0-pro': {
    llm: 'VertexAI',
    label: 'Gemini 1.0 Pro',
    supportsSystemPrompt: true,
    tokens: 32760,
    completionTokens: 8192,
  },
  'claude-3-5-haiku': {
    llm: 'VertexAI',
    label: 'Claude 3.5 Haiku',
    supportsSystemPrompt: true,
    tokens: 200000,
    completionTokens: 8192,
    tags: ['new'],
  },
  'claude-3-5-sonnet-v2': {
    llm: 'VertexAI',
    label: 'Claude 3.5 Sonnet',
    supportsSystemPrompt: true,
    tokens: 200000,
    completionTokens: 8192,
    tags: ['v2', 'new'],
  },
  'claude-3-5-sonnet': {
    llm: 'VertexAI',
    label: 'Claude 3.5 Sonnet',
    supportsSystemPrompt: true,
    tokens: 200000,
    completionTokens: 8192,
    tags: ['v1'],
  },
  'claude-3-sonnet': {
    llm: 'VertexAI',
    label: 'Claude 3 Sonnet',
    supportsSystemPrompt: true,
    tokens: 200000,
    completionTokens: 4096,
  },
  'claude-3-opus': {
    llm: 'VertexAI',
    label: 'Claude 3 Opus',
    supportsSystemPrompt: true,
    tokens: 200000,
    completionTokens: 4096,
  },
  'claude-3-haiku': {
    llm: 'VertexAI',
    label: 'Claude 3 Haiku',
    supportsSystemPrompt: true,
    tokens: 200000,
    completionTokens: 4096,
  },
  gemma2: {
    llm: 'VertexAI',
    label: 'Gemma 2',
    supportsSystemPrompt: true,
    tokens: 8192, // @Ref https://huggingface.co/blog/gemma2
    completionTokens: 4096, // @Ref - https://console.cloud.google.com/vertex-ai/publishers/google/model-garden/gemma2?authuser=1&project=opt-smythos-vertexia-432522
  },
  gemma: {
    llm: 'VertexAI',
    label: 'Gemma',
    supportsSystemPrompt: true,
    tokens: 8192, // @Ref https://huggingface.co/blog/gemma2
    completionTokens: 4096, // @Ref - https://console.cloud.google.com/vertex-ai/publishers/google/model-garden/gemma?authuser=1&project=opt-smythos-vertexia-432522
  },
  codegemma: {
    llm: 'VertexAI',
    label: 'CodeGemma',
    supportsSystemPrompt: true,
    tokens: 8192, // @Ref - https://huggingface.co/google/gemma-7b-it/discussions/73
    completionTokens: 4096, // @Ref - https://console.cloud.google.com/vertex-ai/publishers/google/model-garden/codegemma?authuser=1&project=opt-smythos-vertexia-432522
  },
  'llama3-405b-instruct-maas': {
    llm: 'VertexAI',
    label: 'Llama 3.1 API Service',
    supportsSystemPrompt: true,
    tokens: 4096, // @Ref - https://docs.together.ai/docs/chat-models
    completionTokens: 4096, // @Ref - https://console.cloud.google.com/vertex-ai/publishers/meta/model-garden/llama3-405b-instruct-maas?authuser=1&project=opt-smythos-vertexia-432522
  },
  llama3_1: {
    llm: 'VertexAI',
    label: 'Llama 3.1',
    supportsSystemPrompt: true,
    tokens: 4096, // by querying with Gemini - https://gemini.google.com/
    completionTokens: 4096, // by querying with Gemini - https://gemini.google.com/
  },
  'llama-guard': {
    llm: 'VertexAI',
    label: 'Llama Guard',
    supportsSystemPrompt: true,
    tokens: 8192, // @Ref - by querying with Gemini - https://gemini.google.com/
    completionTokens: 4096, // @Ref - https://console.cloud.google.com/vertex-ai/publishers/meta/model-garden/llama-guard?authuser=1&project=opt-smythos-vertexia-432522
  },
  llama3: {
    llm: 'VertexAI',
    label: 'Llama 3',
    supportsSystemPrompt: true,
    tokens: 8192, // @Ref - https://console.cloud.google.com/vertex-ai/publishers/meta/model-garden/llama3?_ga=2.79473366.358158393.1724662649-247251619.1697981116&authuser=1&project=opt-smythos-vertexia-432522
    completionTokens: 4096, // @Ref - https://console.cloud.google.com/vertex-ai/publishers/meta/model-garden/llama3?_ga=2.79473366.358158393.1724662649-247251619.1697981116&authuser=1&project=opt-smythos-vertexia-432522
  },
  llama2: {
    llm: 'VertexAI',
    label: 'Llama 2',
    value: 'llama2',
    supportsSystemPrompt: true,
    tokens: 4096, // @Ref - https://console.cloud.google.com/vertex-ai/publishers/meta/model-garden/llama2?authuser=1&project=opt-smythos-vertexia-432522
    completionTokens: 4096, // @Ref - https://console.cloud.google.com/vertex-ai/publishers/meta/model-garden/llama2?authuser=1&project=opt-smythos-vertexia-432522
  },
  'mistral-large': {
    llm: 'VertexAI',
    label: 'Mistral Large (2407)',
    supportsSystemPrompt: true,
    tokens: 128000, // @Ref - https://console.cloud.google.com/vertex-ai/publishers/mistralai/model-garden/mistral-large?authuser=1&project=opt-smythos-vertexia-432522
    completionTokens: 8192, // Guessing from the context window (tokens)
  },
  'mistral-nemo': {
    llm: 'VertexAI',
    label: 'Mistral Nemo',
    supportsSystemPrompt: true,
    tokens: 128000, // @Ref - https://console.cloud.google.com/vertex-ai/publishers/mistralai/model-garden/mistral-nemo?authuser=1&project=opt-smythos-vertexia-432522
    completionTokens: 8192, // Guessing from the context window (tokens)
  },
  codestral: {
    llm: 'VertexAI',
    label: 'Codestral',
    supportsSystemPrompt: true,
    tokens: 32000, // @Ref - https://console.cloud.google.com/vertex-ai/publishers/mistralai/model-garden/codestral?authuser=1&project=opt-smythos-vertexia-432522
    completionTokens: 4096, // Guessing from the context window (tokens)
  },
  mixtral: {
    llm: 'VertexAI',
    label: 'Mixtral',
    supportsSystemPrompt: true,
    tokens: 32000, // @Ref - https://console.cloud.google.com/vertex-ai/publishers/mistral-ai/model-garden/mixtral?authuser=1&project=opt-smythos-vertexia-432522
    completionTokens: 4096, // @Ref - https://console.cloud.google.com/vertex-ai/publishers/mistral-ai/model-garden/mixtral?authuser=1&project=opt-smythos-vertexia-432522
  },
  'chat-bison': {
    llm: 'VertexAI',
    label: 'PaLM 2 Chat Bison',
    supportsSystemPrompt: true,
    tokens: 4096, // @Ref - by querying with Gemini - https://gemini.google.com/
    completionTokens: 2048, // @Ref - https://console.cloud.google.com/vertex-ai/generative/language/create/chat?model=chat-bison@002&authuser=1&project=opt-smythos-vertexia-432522 [Playground]
  },
  'text-bison': {
    llm: 'VertexAI',
    label: 'PaLM 2 Text Bison',
    supportsSystemPrompt: true,
    tokens: 32768, // by querying with Gemini - https://gemini.google.com/
    completionTokens: 2048, // @Ref - https://console.cloud.google.com/vertex-ai/generative/language/create/text?model=text-bison@001&authuser=1&project=opt-smythos-vertexia-432522 [Playground]
  },
  phi3: {
    llm: 'VertexAI',
    label: 'Phi-3',
    supportsSystemPrompt: true,
    tokens: 128000, // @Ref - https://console.cloud.google.com/vertex-ai/publishers/microsoft/model-garden/phi3?authuser=1&project=opt-smythos-vertexia-432522
    completionTokens: 8192, // Guessing from the context window (tokens)
  },
  qwen2: {
    llm: 'VertexAI',
    label: 'Qwen2',
    supportsSystemPrompt: true,
    tokens: 131072, // @Ref - https://huggingface.co/Qwen/Qwen2-72B-Instruct
    completionTokens: 8192, // Guessing from the context window (tokens)
  },
  mammut: {
    llm: 'VertexAI',
    label: 'MaMMUT',
    supportsSystemPrompt: true,
    tokens: 4096, // @Ref - by querying with Gemini - https://gemini.google.com/
    completionTokens: 2048, // @Ref - by querying with Gemini - https://gemini.google.com/
  },
  'lmsys-vicuna-7b': {
    llm: 'VertexAI',
    label: 'Vicuna',
    supportsSystemPrompt: true,
    tokens: 4096, // @Ref - https://docs.together.ai/docs/chat-models
    completionTokens: 2048, // @Ref - Guessing from the context window (tokens)
  },
  'bio-gpt': {
    llm: 'VertexAI',
    label: 'BioGPT',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'microsoft-biomedclip': {
    llm: 'VertexAI',
    label: 'BiomedCLIP',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  mistral: {
    llm: 'VertexAI',
    label: 'Mistral Self-host (7B & Nemo)',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  nllb: {
    llm: 'VertexAI',
    label: 'NLLB',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'codellama-7b-hf': {
    llm: 'VertexAI',
    label: 'Code Llama',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'palmyra-med': {
    llm: 'VertexAI',
    label: 'Palmyra Med (Writer)',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'llama-2-quantized': {
    llm: 'VertexAI',
    label: 'Llama 2 (Quantized)',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'bert-base-uncased': {
    llm: 'VertexAI',
    label: 'BERT (PEFT)',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'falcon-instruct-7b-peft': {
    llm: 'VertexAI',
    label: 'Falcon-instruct (PEFT)',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  openllama: {
    llm: 'VertexAI',
    label: 'OpenLLaMA (PEFT)',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'roberta-large': {
    llm: 'VertexAI',
    label: 'RoBERTa-large (PEFT)',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'xlm-roberta-large': {
    llm: 'VertexAI',
    label: 'XLM-RoBERTa-large (PEFT)',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'bart-large-cnn': {
    llm: 'VertexAI',
    label: 'Bart-large-cnn',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'dolly-v2': {
    llm: 'VertexAI',
    label: 'Dolly-v2',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  imagetext: {
    llm: 'VertexAI',
    label: 'Imagen for Captioning & VQA',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'codechat-bison': {
    llm: 'VertexAI',
    label: 'Codey for Code Chat',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'code-bison': {
    llm: 'VertexAI',
    label: 'Codey for Code Generation',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'code-gecko': {
    llm: 'VertexAI',
    label: 'Codey for Code Completion',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'text-unicorn': {
    llm: 'VertexAI',
    label: 'PaLM 2 Text Unicorn',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'textembedding-gecko': {
    llm: 'VertexAI',
    label: 'Embeddings for Text',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  't5-flan': {
    llm: 'VertexAI',
    label: 'T5-FLAN',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  't5-1.1': {
    llm: 'VertexAI',
    label: 'T5-1.1',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'blip2-opt-2.7-b': {
    llm: 'VertexAI',
    label: 'BLIP2',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'instruct-pix2pix': {
    llm: 'VertexAI',
    label: 'InstructPix2Pix',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'bert-base': {
    llm: 'VertexAI',
    label: 'BERT',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'mediapipe-mobile-bert-classifier': {
    llm: 'VertexAI',
    label: 'MobileBERT Classifier (MediaPipe)',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'mediapipe-average-word-embedding-classifier': {
    llm: 'VertexAI',
    label: 'Average Word Embedding Classifier (MediaPipe)',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  pic2word: {
    llm: 'VertexAI',
    label: 'Pic2Word Composed Image Retrieval',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'text-translation': {
    llm: 'VertexAI',
    label: 'Text Translation',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'language-v1-moderate-text': {
    llm: 'VertexAI',
    label: 'Text Moderation',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'language-v1-analyze-syntax': {
    llm: 'VertexAI',
    label: 'Syntax analysis',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'language-v1-analyze-entity-sentiment': {
    llm: 'VertexAI',
    label: 'Entity sentiment analysis',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'language-v1-analyze-sentiment': {
    llm: 'VertexAI',
    label: 'Sentiment analysis',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'language-v1-classify-text-v1': {
    llm: 'VertexAI',
    label: 'Content classification',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
  'pt-test': {
    llm: 'VertexAI',
    label: 'Entity analysis',
    supportsSystemPrompt: false,
    completionTokens: 4096, // Guessed value, no reference
  },
};
