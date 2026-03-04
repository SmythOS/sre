## Vector Databases

The SmythOS SDK provides a unified interface for working with vector databases. This guide covers:

-   **Standalone usage**: Use VectorDBs directly from your application with team-level scope
-   **Agent usage**: Use VectorDBs through agents with automatic data isolation and access control
-   **Supported providers**: Pinecone, Milvus/Zilliz, and RAMVec (in-memory)
-   **Configuration**: Embeddings models, chunking settings, and connector-specific options
-   **Operations**: Insert, update, delete, search, and purge documents

### Key concepts

-   **Namespace**: A logical collection within a VectorDB (e.g., an index/collection scope). All operations in the SDK happen within a namespace.
-   **Document/Datasource**: A document you insert via `insertDoc()`. The SDK automatically chunks long text into multiple vectors, but all chunks are tracked together as a single document with the name you provide.
-   **Scope & access control**:
    -   Standalone usage defaults to the current team scope.
    -   Agent usage defaults to the agent's scope, isolating data between agents by default.
    -   You can explicitly share agent data at the team level by passing `Scope.TEAM` as the third parameter.
-   **Embeddings**: Embeddings configuration is optional for most VectorDB connectors and defaults to OpenAI `text-embedding-3-large` with 1024 dimensions. You can override this by providing custom embeddings configuration. The SDK automatically generates vectors for you when you pass raw text or parsed documents.

### Supported Vector Databases

-   **Pinecone** - Production-ready managed vector database
-   **Milvus/Zilliz** - Open-source/cloud vector database
-   **RAMVec** - In-memory vector database for development and testing (no persistence, data lost on restart)

### Supported embeddings providers

-   **OpenAI**: models `text-embedding-3-large`, `text-embedding-ada-002`
-   **Google AI**: model `gemini-embedding-001`, `text-embedding-005`, `text-multilingual-embedding-002`

**Embeddings notes:**

-   OpenAI `text-embedding-ada-002` produces fixed 1536-dimensional vectors and does not support custom `dimensions`.
-   OpenAI `text-embedding-3-large` produces 3072-dimensional vectors by default and supports custom dimensions (recommended: 512, 768, 1536, or 3072).
-   Google AI `gemini-embedding-001` produces 3072-dimensional vectors by default and supports custom dimensions (recommended: 768, 1536, or 3072).
-   If an embeddings provider doesn't support your requested dimension size, the SDK automatically normalizes and truncates/pads vectors to match.
-   When embeddings configuration is omitted, connectors default to OpenAI `text-embedding-3-large` with 3072 dimensions.

> **Important Note**: Please keep in mind that your vectorDB index configuration must match the dimensions of the embeddings model you are using, otherwise, the VectorDB provider will reject your operations.

---

## Standalone usage

Import from `@smythos/sdk`:

```ts
import { VectorDB, Model, Doc } from '@smythos/sdk';
```

### Configure embeddings

Embeddings are configured directly in the VectorDB configuration using the `Model` factory. Use `Model.OpenAI()` or `Model.GoogleAI()` to specify which embedding model to use:

```ts
const config = {
    // ... other config
    embeddings: {
        model: Model.OpenAI('text-embedding-3-large'),
        // or Model.GoogleAI('gemini-embedding-001')
        chunkSize: 1000, // optional: default chunk size
        chunkOverlap: 100, // optional: default overlap
        dimensions: 1024, // optional: vector dimensions
    },
};
```

If you omit the `embeddings` configuration entirely, the SDK defaults to OpenAI `text-embedding-3-large` with 1024 dimensions.

### Pinecone example (standalone)

```ts
const pinecone = VectorDB.Pinecone('my_namespace', {
    indexName: 'demo-vec',
    apiKey: process.env.PINECONE_API_KEY,
    embeddings: {
        model: Model.OpenAI('text-embedding-3-large'),
        chunkSize: 1000, // default chunk size for all data insertions
        chunkOverlap: 100, // default chunk overlap for all data insertions
    },
});

// Destructive: clears all vectors in the namespace
await pinecone.purge();

// Insert raw text with options
await pinecone.insertDoc('hello', 'Hello, world!', {
    metadata: { topic: 'greeting' }, // optional metadata
    chunkSize: 500, // optional: override default chunkSize for this insert
    chunkOverlap: 50, // optional: override default chunkOverlap for this insert
});

// Insert and get full vector info
const result = await pinecone.insertDoc('hello', 'Hello, world!', {
    metadata: { topic: 'greeting' },
    returnFullVectorInfo: true, // returns detailed vector information
});

// Search
const results = await pinecone.search('Hello', { topK: 5 });
```

### Milvus example (standalone)

```ts
const milvus = VectorDB.Milvus('demo_vec', {
    credentials: {
        address: process.env.MILVUS_ADDRESS,
        // Either token OR user/password
        user: process.env.MILVUS_USER,
        password: process.env.MILVUS_PASSWORD,
        token: process.env.MILVUS_TOKEN,
    },
    embeddings: {
        model: Model.OpenAI('text-embedding-3-large'),
        chunkSize: 1000,
        chunkOverlap: 100,
    },
});

await milvus.purge();
const results = await milvus.search('my query', { topK: 5 });
```

### RAMVec example (standalone, dev only)

RAMVec is an in-memory vector database. Embeddings configuration is optional; if not provided, it defaults to OpenAI `text-embedding-3-large` with 1024 dimensions.

```ts
// Example with custom embeddings configuration
const ram = VectorDB.RAMVec('my_namespace', {
    embeddings: {
        model: Model.OpenAI('text-embedding-3-large'),
        dimensions: 500,
        chunkSize: 1000,
        chunkOverlap: 100,
    },
});

await ram.purge();
await ram.insertDoc('hello', 'Hello, world!');
const results = await ram.search('Hello');

// Or use with default embeddings (zero-config)
const ramDefault = VectorDB.RAMVec('my_namespace');
await ramDefault.insertDoc('doc1', 'Some text');
```

### Inserting parsed documents

The SDK provides `Doc` parsers (`Doc.pdf`, `Doc.text`, `Doc.md`, etc.) to parse files into structured documents. When you pass a parsed document to `insertDoc()`, the SDK automatically:

-   Chunks the content based on `chunkSize` and `chunkOverlap` settings
-   Creates vectors for each chunk using the configured embeddings model
-   Enriches each chunk's metadata with page numbers, titles, and other document information
-   Stores all chunks under the single document name you provide

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
// Update a document (appends new vectors – delete first if you want to replace)
// updateDoc() accepts the same options as insertDoc()
await pinecone.updateDoc('hello', 'Hello again!', {
    metadata: { version: '2' },
    chunkSize: 500, // optional override
});

// Delete a document by name
await pinecone.deleteDoc('hello');

// Purge entire namespace (destructive - removes all documents)
await pinecone.purge();

// Search with options
const hits = await pinecone.search('query', {
    topK: 10, // number of results (default: 10)
    includeEmbeddings: false, // include vector values (default: false)
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

When you initialize VectorDB connectors from an `Agent` context, the SDK provides automatic data isolation and access control:

-   **Agent-scoped by default**: Data inserted by an agent is only accessible to that specific agent
-   **Stable agent IDs**: Set an `id` on your agent to maintain consistent data isolation across runs
-   **Team sharing**: Pass `Scope.TEAM` as the third parameter to share data at the team level instead
-   **Same API**: All operations (`insertDoc`, `search`, `deleteDoc`, etc.) work the same way

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
    apiKey: process.env.PINECONE_API_KEY,
    embeddings: {
        model: Model.OpenAI('text-embedding-3-large'),
        // You can also use GoogleAI : e.g. Model.GoogleAI('gemini-embedding-001')
        chunkSize: 1000,
        chunkOverlap: 100,
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

**Key points for agent-based VectorDB usage:**

-   **Set a stable agent ID**: Always provide an `id` when creating agents that use VectorDBs. Without an ID, data isolation boundaries won't persist across agent restarts.
-   **Default scope is agent-level**: When you call `agent.vectorDB.Pinecone(...)` without a third parameter, data is isolated to that specific agent.
-   **Share with team**: To make data accessible at the team level, pass `Scope.TEAM` as the third parameter: `agent.vectorDB.Pinecone(namespace, settings, Scope.TEAM)`.
-   **Scope only applies to agents**: Passing `Scope` parameters to standalone `VectorDB.*` constructors will log a warning and default to team scope.

---

## Configuration reference

Each VectorDB connector requires specific configuration. All connectors support optional `embeddings` configuration.

### Pinecone

```ts
type PineconeConfig = {
    apiKey: string; // Your Pinecone API key
    indexName: string; // Name of an existing Pinecone index
    embeddings?: TEmbeddings; // Optional embeddings config (defaults to OpenAI text-embedding-3-large)
};
```

**Requirements**: You must create the Pinecone index beforehand through the Pinecone console or API. The SDK does not create indexes automatically.

### Milvus

```ts
type MilvusConfig = {
    credentials:
        | { address: string; token: string } // Token-based auth
        | { address: string; user: string; password: string; token?: string }; // Username/password auth
    embeddings?: TEmbeddings; // Optional embeddings config (defaults to OpenAI text-embedding-3-large)
};
```

**Authentication**: Provide either `token` OR `user`/`password`. If both are provided, token takes precedence.

### RAMVec (in-memory)

```ts
type RAMVectorDBConfig = {
    embeddings?: TEmbeddings; // Optional embeddings config (defaults to OpenAI text-embedding-3-large, 1024 dims)
};
```

**Note**: RAMVec stores all data in memory. Data is lost when your application restarts. Use only for development and testing.

### Embeddings Configuration

```ts
type TEmbeddings = {
    model: ReturnType<typeof Model.OpenAI> | ReturnType<typeof Model.GoogleAI>;
    // Use Model.OpenAI('model-name') or Model.GoogleAI('model-name')

    credentials?: { apiKey: string }; // Optional: API key for the embeddings provider
    dimensions?: number; // Optional: Vector dimensions (model-dependent)
    timeout?: number; // Optional: Request timeout in milliseconds
    chunkSize?: number; // Optional: Default chunk size for text splitting (default: 512)
    chunkOverlap?: number; // Optional: Default overlap between chunks (default: 100)
    stripNewLines?: boolean; // Optional: Remove newlines from text (default: true)
};
```

**Credentials resolution:**

-   **OpenAI**: API key resolved from the platform's credential system or `OPENAI_API_KEY` environment variable
-   **Google AI**: API key resolved from the credential system or `GOOGLE_AI_API_KEY` environment variable
-   You can also provide credentials directly via the `credentials` field

### Insert/Update Options

```ts
type TInsertDocOptions = {
    metadata?: Record<string, any>; // Custom metadata to attach to all vector chunks
    chunkSize?: number; // Override default chunk size for this specific insert
    chunkOverlap?: number; // Override default chunk overlap for this specific insert
    returnFullVectorInfo?: boolean; // Return detailed vector information (default: false returns void)
};
```

These options apply to both `insertDoc()` and `updateDoc()` methods.

---

## Tips & gotchas

-   **Destructive operations**: `purge()` deletes the entire namespace and all its documents. Use with caution.
-   **Document names are normalized**: Document names provided to `insertDoc()` are lowercased and non-alphanumerics are converted to `_` for internal IDs.
-   **updateDoc() appends, doesn't replace**: The `updateDoc()` method adds new vectors alongside existing ones. To replace a document completely, first call `deleteDoc()` then `insertDoc()`.
-   **Automatic chunking**: The SDK automatically chunks long text based on `chunkSize` and `chunkOverlap` settings. Each chunk becomes a separate vector, but all are tracked under the same document name.
-   **Metadata enrichment**: When inserting parsed documents, the SDK automatically adds metadata like page numbers, document titles, and source information to each chunk.
-   **Search defaults**: `topK` defaults to 10. Only set `includeEmbeddings: true` when you need the actual vector values, as this increases response size.
-   **Scope and isolation**:
    -   Standalone VectorDBs default to team scope
    -   Agent-initialized VectorDBs default to agent scope (data isolated per agent)
    -   Pass `Scope.TEAM` as the third parameter to share agent data at team level
-   **Embeddings defaults**: If you don't specify embeddings configuration, the SDK uses OpenAI `text-embedding-3-large` with 1024 dimensions.

---

## Extensibility

The SDK allows you to add type definitions for custom VectorDB providers by augmenting the `IVectorDBProviders` interface:

```ts
declare module '@smythos/sdk' {
    interface IVectorDBProviders {
        Vectra: {
            indexId: string;
            apiSecret: string;
            embeddings?: TEmbeddings;
        };
    }
}
```

After adding this declaration, TypeScript will recognize `VectorDB.Vectra()` as a valid factory method with proper type checking:

```ts
const vectra = VectorDB.Vectra('my_namespace', {
    indexId: 'my-index',
    apiSecret: process.env.VECTRA_SECRET,
    embeddings: {
        model: Model.OpenAI('text-embedding-3-large'),
    },
});
```

**Important**: This only adds TypeScript type definitions. You must also implement the corresponding SRE connector (`@smythos/sre`) to handle the actual VectorDB operations. See the [SRE documentation for details on implementing custom connectors](https://smythos.github.io/sre/core/documents/extend_Connectors.html)
