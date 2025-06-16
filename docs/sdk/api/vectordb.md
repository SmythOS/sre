# VectorDB and VectorDBInstance

`VectorDB` factories create `VectorDBInstance` objects used to store and search embeddings.

```typescript
import { VectorDB, Model } from '@smythos/sdk';

const pinecone = VectorDB.Pinecone('demo', {
    indexName: 'demo-vec',
    embeddings: Model.OpenAI('text-embedding-3-large'),
});
```

```typescript
await pinecone.insertDoc('intro', 'Hello world');
const results = await pinecone.search('Hello');
```
