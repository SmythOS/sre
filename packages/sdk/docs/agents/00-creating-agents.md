# Creating Agents

The SmythOS SDK offers flexible ways to create and configure agents. This guide covers everything from basic agent creation to advanced model configuration.

The example scripts in [`examples/01-agent-code-skill`](https://github.com/SmythOS/sre/blob/main/examples/01-agent-code-skill), [`examples/02-agent-smyth-file`](https://github.com/SmythOS/sre/blob/main/examples/02-agent-smyth-file), and [`examples/03-agent-workflow-components`](https://github.com/SmythOS/sre/blob/main/examples/03-agent-workflow-components) provide hands-on illustrations of all the concepts covered here.

## Code-Based Agent Creation

You can define agents programmatically by instantiating the `Agent` class with configuration options:

```typescript
import { Agent } from '@smythos/sdk';

const agent = new Agent({
    id: 'crypto-assistant', // Optional: unique identifier
    name: 'CryptoMarket Assistant',
    behavior: 'You are a crypto price tracker...',
    model: 'gpt-4o', // The language model to use
});
```

**Configuration Options:**

-   `id` (optional): A unique identifier for the agent. Useful for persistence and tracking.
-   `name`: A descriptive name for the agent.
-   `behavior`: Instructions that define the agent's persona and role.
-   `model`: The language model to use (see [Model Configuration](#model-configuration) below).
-   `mode` (optional): Agent execution mode. See [Agent Modes](02-agent-modes.md).

## Importing from .smyth Files

For complex agents with visual workflows created in the [SmythOS Builder](https://app.smythos.com/), you can import pre-configured `.smyth` files:

```typescript
import { Agent, Model } from '@smythos/sdk';
import path from 'path';

const agentPath = path.resolve(__dirname, './my-agent.smyth');

const agent = Agent.import(agentPath, {
    model: 'gpt-4o', // Override the model
    teamId: 'team-123', // Optional: specify team context
});
```

The `.smyth` file format allows you to define complex workflows with multiple components, skills, and integrations visually, then import them into your code with full programmatic control.

## Model Configuration

SmythOS provides multiple ways to configure language models, from simple to advanced:

### Simple Model Configuration

The easiest way is to specify a model by name. The SDK keeps an up-to-date list of popular models:

```typescript
const agent = new Agent({
    name: 'My Agent',
    behavior: 'You are a helpful assistant',
    model: 'gpt-4o', // Simple string notation
});
```

**Supported model names include:**

-   OpenAI: `'gpt-4o'`, `'gpt-4-turbo'`, `'gpt-3.5-turbo'`, etc.
-   Anthropic: `'claude-4-sonnet'`, `'claude-3.5-sonnet'`, `'claude-3-opus'`, etc.
-   Google: `'gemini-pro'`, `'gemini-1.5-pro'`, etc.
-   And many more...

### Provider-Specific Configuration

For more control over model parameters, use the `Model` factory with provider-specific methods:

#### Simple Provider Notation

```typescript
import { Model } from '@smythos/sdk';

const agent = new Agent({
    name: 'My Agent',
    behavior: 'You are a helpful assistant',
    model: Model.OpenAI('gpt-4o'),
});
```

#### Advanced Provider Notation

Pass custom parameters for fine-tuned control:

```typescript
import { Model } from '@smythos/sdk';

const agent = new Agent({
    name: 'My Agent',
    behavior: 'You are a helpful assistant',
    model: Model.OpenAI('gpt-4o', {
        temperature: 0.7, // Control randomness (0-2)
        topP: 0.9, // Nucleus sampling
        inputTokens: 200000, // context window size
        outputTokens: 8096, // Maximum tokens the model can generate
        maxTokens: 2000, // Maximum allowed output tokens
        frequencyPenalty: 0.0, // Reduce repetition of token sequences (0.0 - 2.0)
        maxThinkingTokens: 1024, // Maximum tokens to think (reasoning models only)
        presencePenalty: 0.0, // Encourages talking about new topics (0.0 - 2.0)
        stopSequences: ['\n\n'], // Stop sequences
        baseURL: 'https://api.openai.com/v1', // Base URL (for custom endpoints)
        topK: 0, // Top K sampling
    }),
});
```

**Available Providers:**

-   `Model.OpenAI(...)` - OpenAI models (GPT-4, GPT-3.5, etc.)
-   `Model.Anthropic(...)` - Claude models
-   `Model.GoogleAI(...)` - Gemini models
-   `Model.Groq(...)` - Groq inference engine
-   `Model.DeepSeek(...)` - DeepSeek models
-   `Model.TogetherAI(...)` - TogetherAI models
-   `Model.Ollama(...)` - Local models via Ollama
-   `Model.xAI(...)` - xAI models (Grok)
-   `Model.Perplexity(...)` - Perplexity models

For a complete guide on model configuration, available parameters, and best practices, see the dedicated [Models Documentation](../09-models.md).

## Next Steps

Now that you know how to create agents, learn how to give them capabilities with [Skills](01-skills.md).
