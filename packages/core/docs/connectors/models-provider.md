# ModelsProvider Connectors

The ModelsProvider subsystem manages LLM model configurations and availability.

> If you are looking for how to configure custom models for a smythOS SDK project, take a look at this video.
> [![Using Custom Models with SmythOS SDK](https://img.youtube.com/vi/dQQipoa2yp8/0.jpg)](https://www.youtube.com/watch?v=dQQipoa2yp8)

## Available Connectors

### JSONModelsProvider

**Role**: JSON-based model configuration provider  
**Summary**: Provides model configurations from JSON files. Manages model metadata, capabilities, and provider-specific settings.

| Setting  | Type                     | Required | Default         | Description                                           |
| -------- | ------------------------ | -------- | --------------- | ----------------------------------------------------- |
| `models` | string \| TLLMModelsList | No       | Built-in models | Directory path to models.json or models object        |
| `mode`   | string                   | No       | `"merge"`       | How to handle custom models: `"merge"` or `"replace"` |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';
//default : this is the default config used by the SDK
//it will look for models in the .smyth/models or ~/.smyth/models
SRE.init({
    ModelsProvider: {
        Connector: 'JSONModelsProvider',
    },
});

//you can customize the models folder
SRE.init({
    ModelsProvider: {
        Connector: 'JSONModelsProvider',
        Settings: {
            models: './config/models.json',
            mode: 'merge',
        },
    },
});
```

> **Note**: If you are using SmythOS SDK, the SDK will initialize SRE for you with the default config, you only need to call SRE.init if you need to set custom configuration for the ModelsProvider connector.

**Configuration Options:**

### Models Setting

-   **String path**: Path to directory containing models .json files
-   **Object**: Direct TLLMModelsList object with model definitions
-   **Undefined**: Uses built-in model configurations

### Mode Setting

-   **`"merge"`**: Combines custom models with built-in models
-   **`"replace"`**: Replaces built-in models entirely with custom ones

**Use Cases:**

-   Custom model configurations
-   Adding organization-specific models
-   Environment-specific model settings
-   Model metadata management

**File Watching:**
When `models` is a directory path, the connector automatically watches for changes and reloads model configurations.

## Custom Models Configuration

### Model JSON Structure

Custom models are defined in JSON files with the following structure:

```json
{
    "model-key": {
        "label": "Human readable name",
        "modelId": "actual-model-identifier",
        "provider": "ProviderName",
        "features": ["text", "image", "tools", "reasoning", "search"],
        "tags": ["New", "Personal"],
        "tokens": 128000,
        "completionTokens": 8192,
        "enabled": true,
        "credentials": "vault",
        "baseURL": "https://custom-api.example.com/v1"
    }
}
```

### Model Properties

| Property             | Type           | Required | Description                                                         |
| -------------------- | -------------- | -------- | ------------------------------------------------------------------- |
| `label`              | string         | Yes      | Human-readable display name                                         |
| `modelId`            | string         | Yes      | Actual model identifier used by the provider                        |
| `provider`           | string         | Yes      | Provider name (OpenAI, Anthropic, etc.)                             |
| `features`           | array          | Yes      | Supported features: `text`, `image`, `tools`, `reasoning`, `search` |
| `tags`               | array          | No       | Categorization tags (e.g., "New", "Personal")                       |
| `tokens`             | number         | Yes      | Maximum input tokens                                                |
| `completionTokens`   | number         | Yes      | Maximum output tokens                                               |
| `enabled`            | boolean        | No       | Whether the model is available (default: true)                      |
| `credentials`        | string\|object | Yes      | Credential configuration (see below)                                |
| `baseURL`            | string         | No       | Custom API endpoint URL                                             |
| `maxReasoningTokens` | number         | No       | Max reasoning tokens (for reasoning models)                         |
| `default`            | boolean        | No       | Mark as default model for the provider                              |

You can use custom models json files to declare online models of known providers (OpenAI, Anthropic, etc.)
or local models.

### Credentials Configuration

#### Vault Credentials

Use `"vault"` to load credentials from the SRE vault:

```json
{
    "my-model": {
        "credentials": "vault"
    }
}
```

#### Direct Credentials

Provide credentials directly as a JSON object:

```json
{
    "my-model": {
        "credentials": {
            "apiKey": "your-api-key-here"
        }
    }
}
```

### Declaring Local Models via OpenAI API

To use local models exposed through OpenAI-compatible APIs:

1. Set `provider` to `"OpenAI"`
2. Specify the local API endpoint in `baseURL`
3. Use appropriate credentials (often a placeholder API key)

```json
{
    "openai/gpt-oss-20b": {
        "modelId": "openai/gpt-oss-20b",
        "provider": "OpenAI",
        "features": ["text", "tools"],
        "tokens": 4096,
        "completionTokens": 2048,
        "default": true,
        "credentials": "vault",
        "baseURL": "http://127.0.0.1:1234/v1"
    },
    "gemma-3n-e4b": {
        "modelId": "google/gemma-3n-e4b",
        "provider": "OpenAI",
        "features": ["text", "tools"],
        "tokens": 4096,
        "completionTokens": 2048,
        "default": true,
        "credentials": "vault",
        "baseURL": "http://127.0.0.1:1234/v1"
    }
}
```
