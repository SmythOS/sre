# Building Agents

The SmythOS SDK offers flexible ways to create and configure agents. This guide covers everything from basic agent creation to advanced model configuration and workflow-based agents.

The example scripts in [`examples/01-agent-code-skill`](https://github.com/SmythOS/sre/blob/main/examples/01-agent-code-skill), [`examples/02-agent-smyth-file`](https://github.com/SmythOS/sre/blob/main/examples/02-agent-smyth-file), and [`examples/03-agent-workflow-components`](https://github.com/SmythOS/sre/blob/main/examples/03-agent-workflow-components) provide hands-on illustrations of all the concepts covered here.

## Creating Agents

There are two primary ways to create agents in SmythOS:

### 1. Code-Based Agent Creation

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
-   `mode` (optional): Agent execution mode (see [Agent Modes](#agent-modes) below).

### 2. Importing from .smyth Files

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
        maxTokens: 2000, // Maximum response length
        topP: 0.9, // Nucleus sampling
        inputTokens: 200000, // context window size, this is the maximum number of tokens that the model can process in one go. it should be smaller or equal to the model official context window size.
        frequencyPenalty: 0.0, // reduce repetition of token sequences (0.0 - 2.0)
        maxThinkingTokens: 1024, // the maximum number of tokens to think (only valid for reasoning models)
        presencePenalty: 0.0, // encourages talking about new topics (0.0 - 2.0)
        stopSequences: ['\n\n'], // the stop sequences of the model
        baseURL: 'https://api.openai.com/v1', // the base URL of the model, it can be used to call custom models
        topK: 0, // the top K of the model
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

For a complete guide on model configuration, available parameters, and best practices, see the dedicated [Models Documentation](09-models.md).

## Agent Modes

Agent modes define how the agent processes and executes tasks:

### Default Mode

The default mode gives you full control over the agent's behavior. The agent relies only on the skills and behavior you provide:

```typescript
const agent = new Agent({
    name: 'My Agent',
    behavior: 'You are a helpful assistant',
    model: 'gpt-4o',
    // mode: TAgentMode.DEFAULT  // This is the default, no need to specify
});
```

### Planner Mode

When enabled, the agent gains advanced planning capabilities. It can split complex jobs into tasks and subtasks, track progress, report status to the user, and execute tasks systematically:

```typescript
import { Agent, TAgentMode } from '@smythos/sdk';

const agent = new Agent({
    name: 'Code Assistant',
    behavior: 'You are a code assistant...',
    model: 'gpt-4o',
    mode: TAgentMode.PLANNER, // Enable planner mode
});

// Listen to planning events
agent.on('TasksAdded', (tasksList, tasks) => {
    console.log('New tasks:', tasks);
});

agent.on('TasksUpdated', (taskId, status, tasks) => {
    console.log(`Task ${taskId} updated:`, status);
});
```

The planner mode is particularly useful for complex, multi-step operations. See the [Planner Mode Example](https://github.com/SmythOS/sre/blob/main/examples/01-agent-code-skill/04.1-chat-planner-coder.ts) for a complete implementation.

## How Agents Use Skills

When you send a prompt to an agent, its underlying Large Language Model (LLM) analyzes the request. It then looks at the list of available skills and, based on their `name` and `description`, determines which skill (if any) is best suited to fulfill the request. The LLM intelligently extracts the necessary parameters from your prompt and passes them to the skill's `process` function.

This is what makes agents so powerful: you provide the tools (skills), and the agent figures out how and when to use them.

## Adding Skills

You can add any number of skills to an agent using the `agent.addSkill()` method. A skill is defined by an object containing a `name`, a `description`, and a `process` handler.

-   `name`: A clear, simple name for the skill.
-   `description`: A crucial piece of text. The LLM relies heavily on the description to understand what the skill does. The more descriptive you are, the better the agent will be at using the skill correctly.
-   `process`: An `async` function that contains the logic of the skill. It receives an object with the parameters the LLM extracts from the prompt.

Here's a more detailed example of a `weather` skill:

```typescript
agent.addSkill({
    name: 'getWeather',
    description: 'Fetches the current weather for a specific city.',
    // The 'process' function receives the 'city' argument extracted by the LLM.
    process: async ({ city }) => {
        // In a real-world scenario, you would call a weather API here.
        console.log(`Fetching weather for ${city}...`);

        if (city.toLowerCase() === 'london') {
            return { temperature: '15°C', condition: 'Cloudy' };
        } else if (city.toLowerCase() === 'tokyo') {
            return { temperature: '28°C', condition: 'Sunny' };
        } else {
            return { error: 'City not found' };
        }
    },
});

// The agent's LLM will see this prompt and decide to use the 'getWeather' skill.
// It will also know to pass 'London' as the 'city' parameter.
const weatherReport = await agent.prompt('What is the weather like in London today?');

console.log(weatherReport);
// Expected output (will vary based on the model's formatting):
// "The weather in London is currently 15°C and cloudy."
```

## Direct Skill Invocation

Sometimes, you don't need the LLM's reasoning. If you know exactly which skill you want to execute and what parameters to use, you can call it directly using `agent.call()`.

This approach has two main advantages:

1.  **Speed**: It's much faster as it bypasses the LLM's analysis step.
2.  **Predictability**: It's deterministic. You get a direct, structured JSON response from the skill, not a natural language answer formatted by the LLM.

```typescript
// Bypassing the LLM to call the 'getWeather' skill directly.
const tokyoWeather = await agent.call('getWeather', { city: 'tokyo' });

console.log(tokyoWeather);
// Expected output:
// { temperature: '28°C', condition: 'Sunny' }
```

Using `agent.call()` is ideal when you need reliable data for the UI or other parts of your application, while `agent.prompt()` is best for creating conversational, AI-driven experiences.

## Next Steps

Now that you understand how to empower your agents with skills, let's explore how to create more dynamic and interactive experiences with [Streaming Responses](03-streaming.md).
