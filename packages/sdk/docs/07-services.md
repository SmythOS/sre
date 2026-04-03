# Using Services Directly

Beyond the agent-centric abstractions, the SmythOS SDK provides direct access to the underlying services for Language Models (LLMs), Storage, and Vector Databases. This allows you to leverage these powerful components independently, without needing an agent instance.

This is useful for tasks like pre-populating a vector database, managing files in your application's storage, or performing a one-off LLM completion.

You can find working examples in scripts like [`10-llm-storage-vectors.ts`](https://github.com/SmythOS/sre/blob/main/examples/01-agent-code-skill/10-llm-storage-vectors.ts) and [`01-upsert-and-search.ts`](https://github.com/SmythOS/sre/blob/main/examples/05-VectorDB-with-agent/01-upsert-and-search.ts).

## Language Models (LLMs)

You can access LLM providers directly to perform completions or other language tasks. An `LLMInstance` behaves much like an agent, supporting methods like `.prompt()` and `.stream()`.

### Via an Agent Instance

When accessed via an agent, the LLM service is already configured.

```typescript
// 'agent' is an existing Agent instance
const openai = agent.llm.OpenAI({ model: 'gpt-4o-mini' });
const haiku = await openai.prompt('Write a haiku about sakura trees');
console.log(haiku);
```

### Standalone Usage

You can also import and use LLM providers directly from the SDK.

```typescript
import { LLM } from '@smythos/sdk';

const anthropic = LLM.Anthropic({ model: 'claude-3-haiku' });
const response = await anthropic.prompt('Why is the sky blue?');
console.log(response);
```

## Storage

The Storage service provides a convenient abstraction over file systems, whether they are local or cloud-based like S3. This allows your application to handle file operations consistently across different environments.

### Via an Agent Instance

An agent provides access to its configured storage providers.

```typescript
// 'agent' is an existing Agent instance
const storage = agent.storage.LocalStorage(); // Or agent.storage.S3() etc.
const fileUri = await storage.write('my-file.txt', 'This is some important data.');
console.log(`File written to: ${fileUri}`);
const content = await storage.read(fileUri);
console.log(`File content: ${content}`);
```

### Standalone Usage

You can use the Storage service directly for general-purpose file management.

```typescript
import { Storage } from '@smythos/sdk';

const localStore = Storage.LocalStorage();
await localStore.write('config.json', JSON.stringify({ setting: 'enabled' }));
```

## Vector Databases

The Vector Database service is essential for managing and searching high-dimensional vector embeddings, which are the cornerstone of semantic search and long-term agent memory.

### Via an Agent Instance

The agent provides configured access to Vector DBs.

```typescript
// 'agent' is an existing Agent instance
const vectra = agent.vectorDB.Vectra({ indexName: 'agent-memory' });
await vectra.insertDoc('fact-01', 'The agent was created today.');
const results = await vectra.search('When was the agent made?', { topK: 1 });
console.log(results);
```

### Standalone Usage

You can use the Vector DB service directly to build your own search applications or data processing pipelines.

```typescript
import { VectorDB, Model } from '@smythos/sdk';

// Initialize a standalone Pinecone vector database instance
const pinecone = VectorDB.Pinecone({
    indexName: 'my-app-docs',
    // We also need to specify which model to use for creating embeddings
    embeddings: Model.OpenAI({ model: 'text-embedding-3-large' }),
});

// Add documents to the index
console.log('Upserting documents...');
await pinecone.insertDoc('doc-1', 'The first rule of SmythOS is to build amazing agents.');
await pinecone.insertDoc('doc-2', 'The second rule is to be creative and have fun.');

// Perform a semantic search
console.log("Searching for 'rules'...");
const searchResults = await pinecone.search('What are the rules?', { topK: 2 });
console.log(searchResults);
```

## Next Steps

You've now covered all the core components of the SDK. For more specific use cases and advanced configurations, check out the [Advanced Topics](08-advanced-topics.md).
