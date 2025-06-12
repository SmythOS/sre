# Using Services

The SDK exposes helper factories for LLMs, storage and vector databases. They can be accessed directly or through an agent instance.

## LLMs

```typescript
import { LLM } from '@smythos/sdk';

const openai = LLM.OpenAI({ model: 'gpt-4o' });
const reply = await openai.prompt('Say hi!');
```

When used from an agent the runtime manages credentials and usage tracking for that agent:

```typescript
const agent = new Agent({ name: 'Writer', model: 'gpt-4o' });
const llm = agent.llm.OpenAI('gpt-4o-mini');
```

## Storage

Standalone storage:

```typescript
import { Storage } from '@smythos/sdk';
const local = Storage.LocalStorage();
await local.write('demo.txt', 'hello');
```

Through an agent the data is isolated by agent identity:

```typescript
const agent1 = new Agent({ name: 'A', model: 'gpt-4o' });
const agent2 = new Agent({ name: 'B', model: 'gpt-4o' });

agent1.storage.LocalStorage().write('text.txt', 'data1');
agent2.storage.LocalStorage().write('text.txt', 'data2'); // stored separately
```

## Vector Databases

```typescript
import { VectorDB, Model } from '@smythos/sdk';

const pinecone = VectorDB.Pinecone('demo', {
    indexName: 'demo-vec',
    embeddings: Model.OpenAI('text-embedding-3-large')
});

await pinecone.insertDoc('intro', 'Hello world');
const results = await pinecone.search('Hello');
```

When accessed via an agent the runtime enforces ACL rules automatically.
