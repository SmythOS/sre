---
title: 'connectors/Vector Databases'
---

# VectorDB Connectors

The VectorDB subsystem provides vector database capabilities for storing and searching high-dimensional embeddings. It supports similarity search, semantic search, and RAG (Retrieval-Augmented Generation) workflows.

## Available Connectors

### RAMVec

**Role**: In-memory vector database connector  
**Summary**: Provides fast vector storage and search using in-memory data structures. Ideal for development, testing, and small-scale applications with moderate vector datasets.

| Setting      | Type        | Required | Default | Description                    |
| ------------ | ----------- | -------- | ------- | ------------------------------ |
| `embeddings` | TEmbeddings | Yes      | -       | Embedding configuration object |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    VectorDB: {
        Connector: 'RAMVec',
        Settings: {
            embeddings: {
                provider: 'openai',
                model: 'text-embedding-3-small',
            },
        },
    },
});
```

**Use Cases:**

-   Development and prototyping
-   Small to medium datasets (< 10K vectors)
-   Fast local testing and experimentation
-   Applications with minimal infrastructure requirements

---

### Pinecone

**Role**: Pinecone cloud vector database connector  
**Summary**: Provides managed vector database service with high performance, scalability, and advanced features like metadata filtering and hybrid search.

| Setting      | Type        | Required | Default | Description                         |
| ------------ | ----------- | -------- | ------- | ----------------------------------- |
| `apiKey`     | string      | Yes      | -       | Pinecone API key for authentication |
| `indexName`  | string      | Yes      | -       | Name of the Pinecone index          |
| `embeddings` | TEmbeddings | Yes      | -       | Embedding configuration object      |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    VectorDB: {
        Connector: 'Pinecone',
        Settings: {
            apiKey: process.env.PINECONE_API_KEY,
            indexName: 'my-knowledge-base',
            embeddings: {
                provider: 'openai',
                model: 'text-embedding-3-small',
            },
        },
    },
});
```

**Use Cases:**

-   Production applications requiring scalability
-   Large-scale vector datasets (millions+ vectors)
-   Applications needing advanced search features
-   Multi-tenant applications with namespace isolation
-   High-availability requirements

---

### Milvus

**Role**: Open-source vector database connector  
**Summary**: Provides integration with Milvus, a scalable open-source vector database supporting hybrid search, multiple vector fields, and advanced indexing algorithms.

| Setting       | Type               | Required | Default | Description                    |
| ------------- | ------------------ | -------- | ------- | ------------------------------ |
| `credentials` | IMilvusCredentials | Yes      | -       | Milvus connection credentials  |
| `embeddings`  | TEmbeddings        | Yes      | -       | Embedding configuration object |

**Credentials Options:**

```typescript
// Token-based authentication
{
    address: 'localhost:19530',
    token: 'your-token'
}

// Username/password authentication
{
    address: 'localhost:19530',
    user: 'username',
    password: 'password'
}
```

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    VectorDB: {
        Connector: 'Milvus',
        Settings: {
            credentials: {
                address: 'localhost:19530',
                user: process.env.MILVUS_USERNAME,
                password: process.env.MILVUS_PASSWORD,
            },
            embeddings: {
                provider: 'openai',
                model: 'text-embedding-3-small',
            },
        },
    },
});
```

**Use Cases:**

-   Self-hosted vector database deployments
-   Applications requiring full control over infrastructure
-   Cost-sensitive production environments
-   Multi-vector field applications
-   Advanced indexing and search requirements

## Embeddings Configuration

All VectorDB connectors require an `embeddings` configuration object that specifies how to generate vector embeddings:

### Supported Embedding Providers

```typescript
type TEmbeddings = {
    provider: 'openai' | 'anthropic' | 'google' | 'huggingface';
    model: string;
    // Additional provider-specific options
};
```

### Example Embedding Configurations

**OpenAI Embeddings:**

```typescript
embeddings: {
    provider: 'openai',
    model: 'text-embedding-3-small'  // or 'text-embedding-3-large'
}
```

**Google Embeddings:**

```typescript
embeddings: {
    provider: 'google',
    model: 'embedding-001'
}
```

**Anthropic Embeddings:**

```typescript
embeddings: {
    provider: 'anthropic',
    model: 'claude-3-haiku'
}
```

## Configuration Notes

### RAMVec

-   Stores all vectors in process memory
-   Data is lost on application restart
-   No persistence or durability guarantees
-   Suitable for temporary/development use only

### Pinecone

-   Requires a Pinecone account and pre-created index
-   Index dimension must match embedding model dimension
-   API key should be stored securely (vault or environment variables)
-   Supports namespaces for multi-tenant applications

### Milvus

-   Requires running Milvus server instance
-   Supports both cloud and self-hosted deployments
-   Collections are created automatically if they don't exist
-   Flexible authentication options (token or username/password)

## Security Best Practices

1. **Store API keys securely** in vault or environment variables
2. **Use appropriate authentication** methods for each provider
3. **Implement proper access controls** for sensitive vector data
4. **Encrypt vector data** at rest and in transit where possible
5. **Regular backup** vector databases for production use
