## Vector Databases

This guide explains how to use Vector Databases with the SDK in two modes:

-   Standalone, directly from your app
-   Through an Agent, with built-in access control and data isolation

It also lists supported VectorDB connectors and embedding providers, details configuration, and shows complete examples for indexing and searching.

### Key concepts

-   **Namespace**: A logical collection within a VectorDB (e.g., an index/collection scope). All operations in the SDK happen within a namespace.
-   **Datasource**: A document you insert. In practice, text is chunked into multiple vectors and tracked as a single datasource id.
-   **Scope & access control**:
    -   Standalone usage defaults to the current team scope.
    -   Agent usage defaults to the agent’s scope, isolating data between agents by default.
    -   You can explicitly share agent data at the team level.
-   **Embeddings**: You must choose an embeddings provider/model. The SDK will generate vectors for you when you pass raw text or parsed documents.

### Supported Vector Databases

-   **Pinecone**
-   **Milvus/Zilliz**
-   **RAMVec (in-memory, zero-config; for development only)**

### Supported embeddings providers

-   **OpenAI**: models `text-embedding-3-large`, `text-embedding-ada-002`
-   **Google AI**: model `gemini-embedding-001`, `text-embedding-005`, `text-multilingual-embedding-002`

Notes:

-   OpenAI `text-embedding-ada-002` does not support custom `dimensions`.
-   Google AI `gemini-embedding-001` defaults to 3072 dimensions and supports custom dimensions (recommended: 768, 1536, or 3072). If the SDK ignores the requested size, the SDK layer normalizes and truncates/pads vectors to your requested length.
-   Default vector dimension used by connectors is 1024 when not provided.

---

## Standalone usage

Import from `@smythos/sdk`:

```ts
import { VectorDB, Model, Doc } from '@smythos/sdk';
```

### Configure an embeddings model

Use the `Model` factory to declare the embeddings you want the VectorDB to use:

```ts
// OpenAI embeddings
const openAIEmbeddings = Model.OpenAI('text-embedding-3-large');

// or Google AI embeddings
const googleEmbeddings = Model.GoogleAI('gemini-embedding-001');
```

### Pinecone example (standalone)

```ts
const pinecone = VectorDB.Pinecone('my_namespace', {
    indexName: 'demo-vec',
    apiKey: process.env.PINECONE_API_KEY!,
    embeddings: {
        model: Model.OpenAI('text-embedding-3-large'),
        chunkSize: 1000, //default chunksize for all data insersions
        chunkOverlap: 100, //default chunkoverlap for all data insersions
    },
});

// Destructive: clears all vectors in the namespace
await pinecone.purge();

// Insert raw text
await pinecone.insertDoc('hello', 'Hello, world!', { metadata: { topic: 'greeting' }, chunkSize: 500, chunkOverlap: 50 }); //chunkSize and chunkOverlap can be overridden for this insert, if not provided, the default values will be used

// Search
const results = await pinecone.search('Hello', { topK: 5 });
```

### Milvus example (standalone)

```ts
const milvus = VectorDB.Milvus('my_namespace', {
    credentials: {
        address: process.env.MILVUS_ADDRESS!,
        // Either token OR user/password
        user: process.env.MILVUS_USER,
        password: process.env.MILVUS_PASSWORD,
        token: process.env.MILVUS_TOKEN,
    },
    embeddings: {
        model: Model.OpenAI('text-embedding-3-large'),
    },
});

await milvus.purge();
const results = await milvus.search('my query', { topK: 5 });
```

### RAMVec example (standalone, dev only)

```ts
// Zero-config in-memory database for quick local testing
const ram = VectorDB.RAMVec('my_namespace');
await ram.purge();
await ram.insertDoc('hello', 'Hello, world!');
const results = await ram.search('Hello');
```

### Inserting parsed documents

Use the SDK `Doc` parsers to turn files or strings into structured documents. The SDK will automatically chunk pages and index them correctly, enriching metadata with page numbers and titles.

```ts
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, './files/bitcoin.pdf');

const parsed = await Doc.pdf.parse(filePath);
await pinecone.insertDoc(parsed.title, parsed, { metadata: { source: 'whitepaper' } });

// Now search by semantics
const hits = await pinecone.search('Proof-of-Work', { topK: 5 });
```

### Common operations

```ts
// Update (appends new vectors – delete first if you want to replace)
await pinecone.updateDoc('hello', 'Hello again!', { version: '2' });

// Delete a document (by name you used during insert)
await pinecone.deleteDoc('hello');

// Purge entire namespace (destructive)
await pinecone.purge();

// Search options
const hits = await pinecone.search('query', {
    topK: 10, // default 10
    includeEmbeddings: false, // default false; set true to include vectors
});
```

Result shape from `search`:

```ts
type SearchHit = {
    embedding?: number[]; // present when includeEmbeddings is true
    text?: string; // chunk text if available
    metadata?: Record<string, any>; // your metadata + SDK-added fields
};
```

---

## Using VectorDBs with Agents

When you initialize VectorDB connectors from an `Agent`, the SDK automatically enforces access control. Data inserted from an agent is isolated to that agent by default. You can opt-in to share at the team level.

```ts
import { Agent, Doc, Model, Scope } from '@smythos/sdk';

// 1) Create an agent with a stable id for data isolation
const agent = new Agent({
    id: 'crypto-market-assistant',
    name: 'CryptoMarket Assistant',
    behavior: '…',
    model: 'gpt-4o',
});

// 2) Initialize a VectorDB inside the agent context
const namespace = 'crypto-ns';
const pineconeSettings = {
    indexName: 'demo-vec',
    apiKey: process.env.PINECONE_API_KEY!,
    embeddings: {
        model: Model.GoogleAI('gemini-embedding-001'),
    },
};

// Default: agent scope (isolated)
const pinecone = agent.vectorDB.Pinecone(namespace, pineconeSettings);

// Optional: share with the agent’s team instead of per-agent isolation
// const pinecone = agent.vectorDB.Pinecone(namespace, pineconeSettings, Scope.TEAM);

await pinecone.purge();

const parsed = await Doc.md.parse('./files/bitcoin.md', {
    title: 'Bitcoin',
    author: 'Satoshi Nakamoto',
    date: '2009-01-03',
    tags: ['bitcoin', 'crypto', 'blockchain'],
});

await pinecone.insertDoc(parsed.title, parsed, { metadata: { source: 'kb' } });

// Query from inside a skill
agent
    .addSkill({
        name: 'retrieve-info',
        description: 'Retrieve information from knowledge base.',
        process: async ({ question }) => {
            const db = agent.vectorDB.Pinecone(namespace, pineconeSettings);
            const hits = await db.search(question, { topK: 10 });
            return JSON.stringify(hits, null, 2);
        },
    })
    .in({ question: { type: 'Text' } });

const reply = await agent.prompt('What is bitcoin Proof-of-Work?');
console.log(reply);
```

Important:

-   **Agent ID**: set `id` on your agent to persist isolation boundaries across runs.
-   **Scope**: omit the third parameter for agent-isolated data; pass `Scope.TEAM` to share with the team.
-   **Standalone misuse**: Passing `Scope.AGENT`/`Scope.TEAM` to standalone `VectorDB.*` logs a warning and defaults to team scope.

---

## Configuration reference

### Pinecone

```ts
type PineconeConfig = {
    apiKey: string; // PINECONE_API_KEY
    indexName: string; // existing index name
    embeddings: TEmbeddings; // see Embeddings below
};
```

### Milvus

```ts
type MilvusConfig = {
    credentials: { address: string; token: string } | { address: string; user: string; password: string; token?: string };
    embeddings: TEmbeddings;
};
```

### RAMVec (in-memory)

```ts
type RAMVectorDBConfig = {
    embeddings?: TEmbeddings; // defaults to OpenAI text-embedding-3-large, 1024 dims
};
```

### Embeddings

```ts
type TEmbeddings = {
    provider: 'OpenAI' | 'GoogleAI';
    model: 'text-embedding-3-large' | 'text-embedding-ada-002' | 'gemini-embedding-001';
    credentials?: { apiKey: string }; // optional; see notes below

    dimensions?: number; // default 1024 for OpenAI, 3072 for Google AI (ada-002 ignores this)
    timeout?: number;
    chunkSize?: number; // batching for bulk embed
    chunkOverlap?: number; // batching for bulk embed
    stripNewLines?: boolean; // default true
};
```

-   **OpenAI credentials**: resolved by the platform’s credential system; typically from your vault or environment.
-   **Google AI credentials**: either via the credential system or fallback to `GOOGLE_AI_API_KEY` env var.

### Environment variables

-   **PINECONE_API_KEY**: Pinecone API key
-   **MILVUS_ADDRESS**, **MILVUS_USER**, **MILVUS_PASSWORD**, **MILVUS_TOKEN**: Milvus/Zilliz connection
-   **GOOGLE_AI_API_KEY**: Fallback for Google AI embeddings

---

## Tips & gotchas

-   **Destructive operations**: `purge()` deletes the entire namespace.
-   **Names are normalized**: document names are lowercased and non-alphanumerics are converted to `_` for internal IDs.
-   **Chunking**: the SDK chunks text automatically when you pass parsed docs or use `insertDoc` with long text, and attaches helpful metadata (page number, title).
-   **Search defaults**: `topK` defaults to 10; set `includeEmbeddings: true` only when you truly need vectors.
-   **Isolation**: agent-initialized VectorDBs default to agent scope; standalone default is team scope.

---

## Extensibility

You can extend SDK typings to reference custom providers from your app by augmenting `IVectorDBProviders`:

```ts
declare module '@smythos/sdk' {
    interface IVectorDBProviders {
        Vectra: { indexId: string; apiSecret: string };
    }
}
```

Note: this exposes typed factory functions in the SDK (e.g., `VectorDB.Vectra`). A working connector must also exist in the SRE core to handle requests for the custom provider.
