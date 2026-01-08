---
title: 'connectors/LLM Providers'
---

# LLM Connectors

The LLM (Large Language Model) subsystem provides access to various language models from different providers. It supports text generation, chat completions, embeddings, and model management with unified interfaces across providers.

## Architecture Overview

**Important**: LLM connectors work differently from other SRE connectors. They **do not have constructor settings**. Instead, configuration is managed through:

1. **Model Configuration**: Via `ModelsProvider` (typically `JSONModelsProvider` using `models.json`)
2. **Credentials Management**: API keys stored in Vault and retrieved dynamically per request
3. **Request-Time Configuration**: Settings passed with each API call

## Available Connectors

### Echo

**Role**: Development and testing LLM connector  
**Summary**: Provides a simple echo service that returns the input prompt. Useful for testing workflows without consuming API credits or requiring external services.

**Configuration**: No constructor settings. Configured through models.json.

**Example Model Entry:**

```json
{
    "echo-test": {
        "label": "Echo Test Model",
        "llm": "Echo",
        "credentials": "None"
    }
}
```

**Use Cases:**

-   Development and testing
-   Workflow validation without API costs
-   Integration testing
-   Debugging prompt flows

---

### OpenAI

**Role**: OpenAI API connector (GPT-3.5, GPT-4, etc.)  
**Summary**: Provides access to OpenAI's language models including GPT-3.5-turbo, GPT-4, and embedding models with full feature support.

**Configuration**: No constructor settings. Requires API key in vault and model configuration.

**Required Vault Entries:**

-   `openai:apiKey` - OpenAI API key

**Example Model Entry:**

```json
{
    "gpt-4": {
        "label": "GPT-4",
        "llm": "OpenAI",
        "modelId": "gpt-4",
        "credentials": "Internal",
        "baseURL": "https://api.openai.com/v1",
        "params": {
            "temperature": 0.7,
            "max_tokens": 4096
        }
    }
}
```

**Use Cases:**

-   Production applications requiring high-quality text generation
-   Chat applications and conversational AI
-   Content creation and writing assistance
-   Code generation and analysis
-   Advanced reasoning tasks

---

### DeepSeek

**Role**: DeepSeek API connector  
**Summary**: Provides access to DeepSeek's language models using OpenAI-compatible API interface. Uses the OpenAI connector internally.

**Configuration**: No constructor settings. Uses OpenAI connector with custom baseURL.

**Required Vault Entries:**

-   `deepseek:apiKey` - DeepSeek API key

**Example Model Entry:**

```json
{
    "deepseek-chat": {
        "label": "DeepSeek Chat",
        "llm": "DeepSeek",
        "modelId": "deepseek-chat",
        "credentials": "Internal",
        "baseURL": "https://api.deepseek.com/v1"
    }
}
```

---

### GoogleAI

**Role**: Google AI (Gemini) connector  
**Summary**: Provides access to Google's Gemini models with support for multimodal inputs, function calling, and Google's advanced AI capabilities.

**Configuration**: No constructor settings.

**Required Vault Entries:**

-   `googleai:apiKey` - Google AI API key

**Example Model Entry:**

```json
{
    "gemini-pro": {
        "label": "Gemini Pro",
        "llm": "GoogleAI",
        "modelId": "gemini-pro",
        "credentials": "Internal"
    }
}
```

---

### Anthropic

**Role**: Anthropic Claude connector  
**Summary**: Provides access to Anthropic's Claude models with strong performance in reasoning, analysis, and safe AI interactions.

**Configuration**: No constructor settings.

**Required Vault Entries:**

-   `anthropic:apiKey` - Anthropic API key

**Example Model Entry:**

```json
{
    "claude-3-sonnet": {
        "label": "Claude 3 Sonnet",
        "llm": "Anthropic",
        "modelId": "claude-3-sonnet-20240229",
        "credentials": "Internal"
    }
}
```

---

### Groq

**Role**: Groq high-speed inference connector  
**Summary**: Provides ultra-fast inference using Groq's specialized hardware. Supports various open-source models with exceptional speed performance.

**Configuration**: No constructor settings.

**Required Vault Entries:**

-   `groq:apiKey` - Groq API key

**Example Model Entry:**

```json
{
    "llama-3-70b": {
        "label": "Llama 3 70B",
        "llm": "Groq",
        "modelId": "llama3-70b-8192",
        "credentials": "Internal"
    }
}
```

---

### Bedrock

**Role**: Amazon Bedrock connector  
**Summary**: Provides access to various foundation models through AWS Bedrock service with enterprise security and compliance features.

**Configuration**: No constructor settings.

**Required Vault Entries:**

-   `aws:accessKeyId` - AWS access key ID
-   `aws:secretAccessKey` - AWS secret access key
-   `aws:region` - AWS region

**Example Model Entry:**

```json
{
    "claude-bedrock": {
        "label": "Claude 3 on Bedrock",
        "llm": "Bedrock",
        "modelId": "anthropic.claude-3-sonnet-20240229-v1:0",
        "credentials": "BedrockVault",
        "region": "us-east-1"
    }
}
```

---

### Additional Connectors

-   **VertexAI**: Google Cloud Vertex AI connector for enterprise deployments
-   **xAI**: Integration with xAI's Grok models
-   **Perplexity**: Access to Perplexity's search-augmented models
-   **TogetherAI**: Community models (uses OpenAI connector)

## Model Configuration

Models are configured through the `ModelsProvider` (typically `JSONModelsProvider`):

### Model Entry Structure

```json
{
    "model-name": {
        "label": "Human readable name",
        "llm": "ConnectorName",
        "modelId": "actual-model-id",
        "credentials": "CredentialType",
        "baseURL": "api-endpoint",
        "params": {
            "temperature": 0.7,
            "max_tokens": 4096
        }
    }
}
```

### Credential Types

| Type              | Description                              |
| ----------------- | ---------------------------------------- |
| `"None"`          | No credentials required (Echo connector) |
| `"Internal"`      | API key from vault (most providers)      |
| `"BedrockVault"`  | AWS credentials for Bedrock              |
| `"VertexAIVault"` | Google Cloud credentials for Vertex AI   |

## ModelsProvider Configuration

The `JSONModelsProvider` connector has constructor settings:

| Setting  | Type                     | Required | Default         | Description                                           |
| -------- | ------------------------ | -------- | --------------- | ----------------------------------------------------- |
| `models` | string \| TLLMModelsList | No       | Built-in models | Directory path to models.json or models object        |
| `mode`   | string                   | No       | `"merge"`       | How to handle custom models: `"merge"` or `"replace"` |

**Example Configuration:**

```typescript
ModelsProvider: {
    Connector: 'JSONModelsProvider',
    Settings: {
        models: './config/models.json',
        mode: 'merge'
    }
}
```

## Credential Management

### Vault Key Format

Credentials are stored in the vault using this format:

-   `{provider}:apiKey` - For most providers (e.g., `openai:apiKey`)
-   `aws:accessKeyId`, `aws:secretAccessKey`, `aws:region` - For AWS services

### Example Vault Setup

```typescript
// Store credentials in vault
await vault.set('openai:apiKey', 'sk-...');
await vault.set('anthropic:apiKey', 'sk-ant-...');
await vault.set('groq:apiKey', 'gsk_...');
```

## Usage Examples

### Basic Usage

```typescript
import { LLM } from '@smythos/sdk';

const llm = new LLM();

// Model name references models.json entry
const response = await llm.chat({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Custom Model Configuration

```typescript
// In models.json
{
  "custom-gpt": {
    "label": "Custom GPT-4",
    "llm": "OpenAI",
    "modelId": "gpt-4",
    "credentials": "Internal",
    "params": {
      "temperature": 0.1,
      "max_tokens": 8192
    }
  }
}

// Usage
const response = await llm.chat({
    model: 'custom-gpt',
    messages: [{ role: 'user', content: 'Hello!' }]
});
```

## Configuration Best Practices

1. **Use the built-in models** as a starting point
2. **Store API keys securely** in the vault, never in code
3. **Use descriptive model names** in your models.json
4. **Set appropriate default parameters** for your use case
5. **Use environment-specific models.json** files for different deployments
