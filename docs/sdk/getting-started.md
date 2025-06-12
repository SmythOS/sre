# Getting Started with the SmythOS SDK

The SmythOS SDK sits on top of the Smyth Runtime Environment (SRE) and exposes a clean API for building AI agents. This document guides you through the main features step by step and references the runnable examples shipped in this repository.

## Installation

Add the SDK to your project:

```bash
npm install @smythos/sdk
```

The SDK automatically boots the runtime with default connectors. To customise the infrastructure you can initialise `SRE` yourself:

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Cache: { Connector: 'RAM' },
    Storage: { Connector: 'Local' },
    Log: { Connector: 'ConsoleLog' },
});
```

## Creating and Prompting Agents

Agents are the core entities. A minimal agent only needs a name, model and behaviour:

```typescript
import { Agent } from '@smythos/sdk';

const agent = new Agent({
    name: 'Assistant',
    model: 'gpt-4o',
    behavior: 'You are a helpful assistant.'
});
```

Prompt the agent directly and optionally stream the response:

```typescript
const answer = await agent.prompt('What is the capital of France?');

const stream = await agent.prompt('Tell me a story').stream();
stream.on('data', chunk => process.stdout.write(chunk));
```

To maintain a conversation use `chat()` which keeps the context between messages:

```typescript
const chat = agent.chat();
await chat.prompt('Hello, who are you?');
await chat.prompt('Do you remember my name?');
```

## Adding Skills

Skills extend an agent with custom code. When a skill exposes a `process` function it becomes available to the LLM as a tool:

```typescript
agent.addSkill({
    name: 'getWeather',
    description: 'Return the current weather for a city',
    process: async ({ city }) => {
        const data = await fetch(`https://api.weather.com?q=${city}`).then(r => r.json());
        return { weather: data.summary };
    }
});
```

Skills can also act as entry points in a workflow as shown later.

## Loading `.smyth` Files

Agents built in the visual builder are saved as `.smyth` files. They can be imported and executed directly:

```typescript
import path from 'path';
import { Agent, Model } from '@smythos/sdk';

const agentPath = path.resolve('crypto-info-agent.smyth');
const agent = Agent.import(agentPath, { model: Model.OpenAI('gpt-4o') });

const result = await agent.prompt('What is the price of Bitcoin?');
```

## Building Workflows in Code

The SDK exposes type safe wrappers for all components under `Component`. Connections are created automatically when you wire inputs to outputs:

```typescript
import { Agent, Component } from '@smythos/sdk';

const agent = new Agent({ name: 'MarketBot', model: 'gpt-4o' });
const skill = agent.addSkill({ name: 'MarketData' });
skill.in({ coin_id: { type: 'string', required: true } });

const apiCall = Component.APICall({
    url: 'https://api.coingecko.com/api/v3/coins/{{coin_id}}?market_data=true',
    method: 'GET'
});
apiCall.in({ coin_id: skill.out.coin_id });

const output = Component.APIOutput({ format: 'minimal' });
output.in({ MarketData: apiCall.out.Response.market_data });
```

## Storage

Storage connectors can be used directly or from an agent. When invoked via an agent the underlying runtime enforces isolation between agents:

```typescript
const store = agent.storage.LocalStorage();
const uri = await store.write('secret.txt', 'Top secret');
```

Two agents writing the same file name will not overwrite each other because their data is scoped by the agent identity:

```typescript
agent1.storage.LocalStorage().write('text.txt', data1);
agent2.storage.LocalStorage().write('text.txt', data2); // stored separately
```

Standalone instances are also available:

```typescript
import { Storage } from '@smythos/sdk';
const local = Storage.LocalStorage();
await local.write('demo.txt', 'hello');
```

## Vector Databases

Vector stores follow the same pattern. Accessing them through an agent applies security policies automatically, while standalone instances are available for low level use:

```typescript
import { VectorDB, Model } from '@smythos/sdk';

const pinecone = VectorDB.Pinecone('demo-vec', {
    indexName: 'demo-vec',
    embeddings: Model.OpenAI('text-embedding-3-large')
});

await pinecone.insertDoc('intro', 'Hello world');
const results = await pinecone.search('Hello');
```

## Using LLMs Directly

You can instantiate an LLM without creating an agent. When used from an agent the runtime manages credentials and usage limits for that agent:

```typescript
import { LLM } from '@smythos/sdk';

const openai = LLM.OpenAI({ model: 'gpt-4o' });
const reply = await openai.prompt('Say hi!');
```

A `.chat()` helper is also available for multi turn interactions.

## Going Further

Combine visual workflows (`.smyth` files) with programmatic skills and components to build complex agents. The [`examples/`](../../examples) folder contains complete sample projects.

For detailed guides see [Agents](agents.md), [Workflows](workflows.md) and [Services](services.md).
