# Agent

The `Agent` class is the main entry point for building AI agents. It bundles a model, optional skills and helper factories for storage, vector databases and LLM access.

```typescript
import { Agent } from '@smythos/sdk';

const agent = new Agent({
    name: 'CryptoMarket Assistant',
    behavior: 'Track crypto prices',
    model: 'gpt-4o',
});
```

## Adding skills

```typescript
agent.addSkill({
    name: 'MarketData',
    description: 'Fetch market data',
    process: async ({ coin_id }) => {
        /* ... */
    },
});
```

Skills can also be defined as workflow entry points. See the examples in `examples/01-agent-code-skill`.

## Prompting

Use `prompt()` to send a question. The returned object supports `.run()` for a final response or `.stream()` for real‑time output.

```typescript
const result = await agent.prompt('Price of Bitcoin?');
```

## Chat sessions

Create a persistent chat to maintain history:

```typescript
const chat = agent.chat({ id: 'my-chat', persist: true });
```

## Storage and VectorDB helpers

Factory accessors provide convenient storage and vector database instances:

```typescript
const local = agent.storage.LocalStorage();
const pinecone = agent.vectorDB.Pinecone('demo');
```

## Importing `.smyth` files

```typescript
const agent2 = Agent.import('path/to/agent.smyth', { model: 'gpt-4o' });
```
