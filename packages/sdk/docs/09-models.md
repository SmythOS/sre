# Language Models in SmythOS

This guide provides comprehensive information about configuring and using language models (LLMs) in the SmythOS SDK.

## Overview

SmythOS supports a wide range of language model providers, from cloud-based services like OpenAI and Anthropic to locally-hosted models via Ollama. The SDK provides flexible configuration options to suit different use cases, from simple model selection to fine-grained parameter control.

## Model Configuration Patterns

There are three main ways to configure models in SmythOS:

### 1. Simple String Notation

The quickest way to get started. Just specify the model name as a string:

```typescript
const agent = new Agent({
    name: 'My Agent',
    behavior: 'You are a helpful assistant',
    model: 'gpt-4o', // Simple and straightforward
});
```

**Benefits:**

-   Minimal configuration
-   SDK keeps an up-to-date list of popular models
-   Automatic provider detection

**Common Model Names:**

-   OpenAI: `'gpt-4o'`, `'gpt-4-turbo'`, `'gpt-4'`, `'gpt-3.5-turbo'`
-   Anthropic: `'claude-4-sonnet'`, `'claude-3.5-sonnet'`, `'claude-3-opus'`, `'claude-3-sonnet'`, `'claude-3-haiku'`
-   Google: `'gemini-pro'`, `'gemini-1.5-pro'`, `'gemini-1.5-flash'`
-   DeepSeek: `'deepseek-chat'`, `'deepseek-coder'`
-   And many more...

### 2. Provider-Specific Simple Notation

When you need to specify a provider explicitly or use a model not in the default list:

```typescript
import { Model } from '@smythos/sdk';

const agent = new Agent({
    name: 'My Agent',
    behavior: 'You are a helpful assistant',
    model: Model.OpenAI('gpt-4o'),
});
```

**Benefits:**

-   Explicit provider selection
-   Works with custom or new models
-   Type-safe provider interface

### 3. Advanced Configuration

For full control over model behavior and parameters:

```typescript
import { Model } from '@smythos/sdk';

const agent = new Agent({
    name: 'My Agent',
    behavior: 'You are a helpful assistant',
    model: Model.OpenAI('gpt-4o', {
        temperature: 0.7, // Control randomness (0.0 - 2.0)
        maxTokens: 2000, // Maximum response length
        topP: 0.9, // Nucleus sampling parameter
        frequencyPenalty: 0.0, // Reduce repetition (0.0 - 2.0)
        presencePenalty: 0.0, // Encourage topic diversity (0.0 - 2.0)
    }),
});
```

**Benefits:**

-   Fine-tuned control over model behavior
-   Performance optimization
-   Cost management via token limits

## Available Providers

SmythOS supports the following LLM providers:

### OpenAI

Access GPT-4, GPT-3.5, and other OpenAI models:

```typescript
model: Model.OpenAI('gpt-4o', {
    temperature: 0.7,
    maxTokens: 4000,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
});
```

**Popular Models:**

-   `gpt-4o` - Latest optimized GPT-4 (multimodal)
-   `gpt-4-turbo` - Fast GPT-4 variant
-   `gpt-4` - Standard GPT-4
-   `gpt-3.5-turbo` - Fast and cost-effective

**API Key:** Store in vault as `"openai": "sk-..."` (see [API Key Management](#api-key-management) below).

### Anthropic (Claude)

Access Claude models from Anthropic:

```typescript
model: Model.Anthropic('claude-4-sonnet', {
    temperature: 1.0,
    maxTokens: 8192,
    topP: 0.9,
});
```

**Popular Models:**

-   `claude-4-sonnet` - Latest Claude model
-   `claude-3.5-sonnet` - Balanced performance
-   `claude-3-opus` - Most capable model
-   `claude-3-sonnet` - Fast and balanced
-   `claude-3-haiku` - Fastest, most cost-effective

**API Key:** Store in vault as `"anthropic": "sk-ant-..."` (see [API Key Management](#api-key-management) below).

### GoogleAI (Gemini)

Access Google's Gemini models:

```typescript
model: Model.GoogleAI('gemini-1.5-pro', {
    temperature: 0.8,
    maxTokens: 2048,
    topP: 0.95,
});
```

**Popular Models:**

-   `gemini-1.5-pro` - Advanced reasoning and long context
-   `gemini-1.5-flash` - Fast and efficient
-   `gemini-pro` - Standard model

**API Key:** Store in vault as `"googleai": "..."` (see [API Key Management](#api-key-management) below).

### Groq

Ultra-fast inference with Groq's LPU™ technology:

```typescript
model: Model.Groq('llama-3.1-70b-versatile', {
    temperature: 0.5,
    maxTokens: 1024,
});
```

**Popular Models:**

-   `llama-3.1-70b-versatile` - Meta's Llama 3.1 (70B)
-   `llama-3.1-8b-instant` - Smaller, faster Llama 3.1
-   `mixtral-8x7b-32768` - Mixtral MoE model

**API Key:** Store in vault as `"groq": "gsk_..."` (see [API Key Management](#api-key-management) below).

### Ollama (Local Models)

Run models locally with Ollama:

```typescript
model: Model.Ollama('llama3.2', {
    temperature: 0.7,
    numCtx: 4096, // Context window size
});
```

**Setup:**

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull models: `ollama pull llama3.2`
3. Start Ollama server (usually runs automatically)

**Popular Models:**

-   `llama3.2` - Latest Llama model
-   `mistral` - Mistral 7B
-   `codellama` - Code-specialized Llama
-   `phi3` - Microsoft's Phi-3

**Configuration:** No API key needed for local Ollama. Configure host URL in SRE config if not using default `http://localhost:11434`

### DeepSeek

Access DeepSeek models:

```typescript
model: Model.DeepSeek('deepseek-chat', {
    temperature: 0.7,
    maxTokens: 2000,
});
```

**Popular Models:**

-   `deepseek-chat` - General conversation model
-   `deepseek-coder` - Specialized for coding tasks

**API Key:** Store in vault as `"deepseek": "..."` (see [API Key Management](#api-key-management) below).

### TogetherAI

Access various open-source models via TogetherAI:

```typescript
model: Model.TogetherAI('meta-llama/Llama-3-70b-chat-hf', {
    temperature: 0.7,
    maxTokens: 2000,
});
```

**API Key:** Store in vault as `"togetherai": "..."` (see [API Key Management](#api-key-management) below).

#### xAI (Grok)

```typescript
model: Model.xAI('grok-beta', {
    temperature: 0.7,
    maxTokens: 2000,
});
```

**API Key:** Store in vault as `"xai": "..."` (see [API Key Management](#api-key-management) below).

#### Perplexity

```typescript
model: Model.Perplexity('llama-3.1-sonar-large-128k-online', {
    temperature: 0.7,
    maxTokens: 2000,
});
```

**API Key:** Store in vault as `"perplexity": "..."` (see [API Key Management](#api-key-management) below).

## Common Model Parameters

Most providers support these common parameters. Here's a quick reference table:

| Parameter           | Type     | Range/Format     | Description                                                                             | Supported By                 |
| ------------------- | -------- | ---------------- | --------------------------------------------------------------------------------------- | ---------------------------- |
| `temperature`       | number   | 0.0 - 2.0        | Controls randomness in responses. Lower = more deterministic, higher = more creative    | All providers                |
| `maxTokens`         | number   | 1 - model limit  | Maximum number of tokens in the response                                                | All providers                |
| `topP`              | number   | 0.0 - 1.0        | Nucleus sampling parameter. Controls diversity via cumulative probability               | Most providers               |
| `topK`              | number   | 0 - ∞            | Limits token selection to top K most likely tokens. 0 = disabled                        | Ollama, some providers       |
| `frequencyPenalty`  | number   | 0.0 - 2.0        | Reduces repetition of token sequences                                                   | OpenAI, compatible providers |
| `presencePenalty`   | number   | 0.0 - 2.0        | Encourages talking about new topics                                                     | OpenAI, compatible providers |
| `stopSequences`     | string[] | Array of strings | Sequences where the model will stop generating                                          | Most providers               |
| `inputTokens`       | number   | 1 - model limit  | Maximum context window size (input tokens). Should be ≤ model's official context window | All providers                |
| `outputTokens`      | number   | 1 - model limit  | The maximum tokens that the model can generate in a single response                     | All providers                |
| `maxThinkingTokens` | number   | 1 - model limit  | Maximum tokens for reasoning/thinking (reasoning models only)                           | OpenAI o1, compatible models |
| `baseURL`           | string   | Valid URL        | Custom API endpoint URL for model inference                                             | Most providers               |

### Detailed Parameter Descriptions

### temperature

Controls randomness in responses (typically 0.0 - 2.0):

-   `0.0` - Deterministic, focused responses
-   `0.5` - Balanced creativity and consistency
-   `1.0` - More creative and varied
-   `2.0` - Highly random and creative

```typescript
model: Model.OpenAI('gpt-4o', { temperature: 0.7 });
```

### maxTokens

Maximum number of tokens in the response:

```typescript
model: Model.OpenAI('gpt-4o', { maxTokens: 2000 });
```

**Note:** Tokens are not the same as words. Roughly 1 token ≈ 0.75 words.

### topP

Nucleus sampling parameter (0.0 - 1.0):

-   Controls diversity via cumulative probability
-   Lower values = more focused, higher values = more diverse

```typescript
model: Model.Anthropic('claude-3-sonnet', { topP: 0.9 });
```

### frequencyPenalty

Reduces repetition of token sequences (0.0 - 2.0):

-   Higher values discourage repeating the same phrases

```typescript
model: Model.OpenAI('gpt-4o', { frequencyPenalty: 0.5 });
```

### presencePenalty

Encourages talking about new topics (0.0 - 2.0):

-   Higher values encourage introducing new topics

```typescript
model: Model.OpenAI('gpt-4o', { presencePenalty: 0.5 });
```

## API Key Management

SmythOS stores API keys securely in a **Vault** system. By default, the SDK uses a JSON file-based vault located at `.smyth/vault.json`.

### Default Vault (JSON File)

The SDK automatically initializes with a JSON vault at `.smyth/vault.json`. This file stores API keys for different providers:

```json
{
    "default": {
        "openai": "sk-...",
        "anthropic": "sk-ant-...",
        "googleai": "...",
        "groq": "gsk_...",
        "deepseek": "...",
        "togetherai": "...",
        "xai": "...",
        "perplexity": "..."
    }
}
```

**Location Options:**

-   **Project-level**: `.smyth/vault.json` in your project directory (recommended)
-   **User-level**: `~/.smyth/vault.json` in your home directory (applies to all projects)

### Environment Variables (Optional)

You can reference environment variables within the vault file using the `$env()` syntax:

```json
{
    "default": {
        "openai": "$env(OPENAI_API_KEY)",
        "anthropic": "$env(ANTHROPIC_API_KEY)",
        "googleai": "$env(GOOGLE_API_KEY)"
    }
}
```

Then set your environment variables:

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="..."
```

### Custom Vault Configuration

For advanced use cases, you can configure a different vault system:

```typescript
import { SRE } from '@smythos/sdk/core';

SRE.init({
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './custom-vault.json',
        },
    },
});
```

Or use cloud-based secret management systems like AWS Secrets Manager for production environments.

### Team-Based API Keys

The vault supports multiple teams with isolated API keys:

```json
{
    "default": {
        "openai": "sk-default-key..."
    },
    "team-production": {
        "openai": "sk-prod-key...",
        "anthropic": "sk-ant-prod-..."
    },
    "team-development": {
        "openai": "sk-dev-key..."
    }
}
```

Agents automatically use keys from their assigned team's vault section.

## Best Practices

### 1. Choose the Right Model for Your Use Case

-   **Complex reasoning**: GPT-4, Claude Opus, Gemini Pro
-   **Fast responses**: GPT-3.5 Turbo, Claude Haiku, Gemini Flash
-   **Cost-effective**: GPT-3.5 Turbo, Groq models, Claude Haiku
-   **Privacy-sensitive**: Ollama (local models)
-   **Long context**: Claude models (100k+ tokens), Gemini 1.5 Pro

### 2. Tune Temperature Based on Task

-   **Factual tasks** (data extraction, analysis): `temperature: 0.0 - 0.3`
-   **Balanced tasks** (chatbots, assistants): `temperature: 0.5 - 0.7`
-   **Creative tasks** (writing, brainstorming): `temperature: 0.8 - 1.2`

### 3. Set Appropriate Token Limits

-   Set `maxTokens` to prevent unexpectedly long (and costly) responses
-   Consider the model's context window when setting limits
-   Remember: input + output tokens count toward the limit

### 4. Test with Different Providers

Different providers excel at different tasks. Test multiple options to find the best fit for your specific use case.

### 5. Monitor Costs

-   Use cheaper models for development/testing
-   Set conservative `maxTokens` limits
-   Consider caching responses for repeated queries
-   Use streaming to provide partial responses quickly

## Examples

### Example 1: Cost-Optimized Configuration

```typescript
import { Agent, Model } from '@smythos/sdk';

const agent = new Agent({
    name: 'Budget Assistant',
    behavior: 'You are a helpful assistant',
    // Use GPT-3.5 for cost efficiency
    model: Model.OpenAI('gpt-3.5-turbo', {
        temperature: 0.5,
        maxTokens: 500, // Keep responses concise
    }),
});
```

### Example 2: High-Quality Reasoning

```typescript
const agent = new Agent({
    name: 'Research Assistant',
    behavior: 'You are an expert researcher',
    // Use Claude Opus for complex reasoning
    model: Model.Anthropic('claude-3-opus', {
        temperature: 0.3, // More focused
        maxTokens: 4096, // Allow detailed responses
    }),
});
```

### Example 3: Local Development

```typescript
const agent = new Agent({
    name: 'Dev Assistant',
    behavior: 'You are a coding assistant',
    // Use Ollama for local development
    model: Model.Ollama('llama3.2', {
        temperature: 0.7,
        numCtx: 4096,
    }),
});
```

### Example 4: Fast Responses with Groq

```typescript
const agent = new Agent({
    name: 'Quick Responder',
    behavior: 'You provide quick answers',
    // Use Groq for ultra-fast inference
    model: Model.Groq('llama-3.1-70b-versatile', {
        temperature: 0.5,
        maxTokens: 1024,
    }),
});
```

### Example 5: Model Override in .smyth Import

```typescript
import { Agent, Model } from '@smythos/sdk';
import path from 'path';

const agentPath = path.resolve(__dirname, './workflow-agent.smyth');

// Import workflow but override the model
const agent = Agent.import(agentPath, {
    model: Model.Anthropic('claude-3.5-sonnet', {
        temperature: 0.8,
    }),
});
```

## Next Steps

Now that you understand model configuration, explore:

-   [Building Agents with Skills](02-agents.md) - Learn how to add capabilities to your agents
-   [Streaming Responses](03-streaming.md) - Handle real-time model outputs
-   [Advanced Topics](08-advanced-topics.md) - Deep dive into advanced features
