# Services

The SDK exposes helpers for common resources such as language models, storage backends and vector databases. You can access them through an agent instance or directly from the SDK. See [`10-llm-storage-vectors.ts`](../../examples/01-agent-code-skill/10-llm-storage-vectors.ts) and [`upsert-and-search.ts`](../../examples/05-VectorDB-with-agent/upsert-and-search.ts) for working code.

## LLMs

`agent.llm` provides a quick way to access different providers. The returned `LLMInstance` supports `.prompt()` and `.stream()` just like an agent.

```typescript
const openai = agent.llm.OpenAI('gpt-4o-mini');
const result = await openai.prompt('Write a haiku about sakura trees');
```

## Storage

Storage helpers abstract where files are kept. During development local storage is convenient, while production might point to S3 or another service.

```typescript
const storage = agent.storage.LocalStorage();
const uri = await storage.write('secret.txt', 'Top secret');
```

Team‑scoped storage is available via `agent.team.storage`.

## Vector Databases

Vector database factories let you store and search embeddings easily.

```typescript
const pinecone = VectorDB.Pinecone('demo', {
    indexName: 'demo-vec',
    embeddings: Model.OpenAI('text-embedding-3-large'),
});

await pinecone.insertDoc('intro', 'Hello world');
const results = await pinecone.search('Hello');
```

These helpers can also be used without an agent when needed.
