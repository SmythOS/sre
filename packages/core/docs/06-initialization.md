---
title: 'Initialization'
---

# SRE Initialization

The Smyth Runtime Environment (SRE) must be initialized before it can be used. The SRE provides multiple initialization approaches to accommodate different use cases and deployment scenarios.

## Initialization Methods

### Implicit Initialization (SDK)

When using the Smyth SDK, the SRE is automatically initialized with default settings or configuration loaded from a configuration file. This provides a seamless development experience for most use cases.

### Explicit Initialization (Programmatic)

For advanced use cases requiring custom configuration, you can explicitly initialize the SRE with specific settings:

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    // Your custom configuration here
    Storage: {
        Connector: 'S3',
        Settings: {
            region: 'us-east-1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            bucket: 'my-storage-bucket',
        },
    },
    VectorDB: {
        Connector: 'Pinecone',
        Settings: {
            apiKey: process.env.PINECONE_API_KEY,
            indexName: 'my-index',
            embeddings: {
                provider: 'openai',
                model: 'text-embedding-3-small',
            },
        },
    },
});
```

## Configuration Structure

The SRE configuration consists of subsystem entries, where each subsystem can be configured with:

-   **Connector**: The specific connector implementation to use
-   **Id**: Optional unique identifier for the connector instance
-   **Settings**: Connector-specific configuration object
-   **Default**: Boolean flag indicating if this is the default connector for the subsystem

### Configuration File

The SRE can be configured using a JSON configuration file located in the `.smyth` directory. This file allows you to persist configuration settings across application restarts and environments.

For detailed configuration options, see the [configuration documentation](../05-configuration.md).

## Default Configuration

When no explicit configuration is provided, the SRE initializes with the following default connector settings:

| Subsystem          | Default Connector  | Purpose                                      |
| ------------------ | ------------------ | -------------------------------------------- |
| **Vault**          | JSONFileVault      | Secure storage for API keys and secrets      |
| **Account**        | DummyAccount       | User account management (development only)   |
| **Cache**          | RAM                | In-memory caching for temporary data         |
| **Storage**        | LocalStorage       | File and blob storage on local filesystem    |
| **Code**           | DummyConnector     | Code execution environment (placeholder)     |
| **NKV**            | LocalStorage       | Named Key-Value storage                      |
| **VectorDB**       | RAMVec             | In-memory vector database for embeddings     |
| **ModelsProvider** | JSONModelsProvider | LLM model configuration provider             |
| **AgentData**      | NullAgentData      | Agent data persistence (null implementation) |
| **Component**      | LocalComponent     | Component loading and management             |
| **ManagedVault**   | NullManagedVault   | Managed secret storage (null implementation) |
| **Log**            | ConsoleLog         | Logging output to console                    |
| **Router**         | NullRouter         | API routing (null implementation)            |

**Note**: LLM connectors are not included in the default configuration. They are configured dynamically through the ModelsProvider subsystem using `models.json` files. Credentials for LLM providers are retrieved from the Vault subsystem at runtime.

## Multiple Connector Instances

The SRE supports running multiple instances of the same subsystem simultaneously. This is useful when:

-   Different agents require specific connector configurations
-   You need to support multiple environments or data sources
-   Testing different connector implementations

Each connector instance can have its own configuration while sharing the same subsystem type.

## Configuration Validation

The SRE automatically validates and normalizes configuration entries during initialization:

-   Missing connector names are logged as warnings and ignored
-   Multiple default connectors trigger warnings (only the first is used)
-   If no default is specified, the first connector becomes the default
-   Configuration entries are converted to arrays for consistent processing

## Ready State

The SRE provides a ready promise to ensure proper initialization sequencing:

```typescript
await SRE.ready();
// SRE is now fully initialized and ready for use
```

This is particularly important when using the SRE in applications that require deterministic startup sequences.

## Connector Configuration Examples

For complete connector configuration details, refer to the specific connector documentation:

### Custom Development Setup

Please note that if you are using Smyth SDK, the SDK will implicitly initialize the SRE for you with default settings. but you can customize the SRE initialization by passing your own settings to the SRE.init method or setting them in a configuration file.

```typescript
SRE.init({
    Storage: { Connector: 'LocalStorage' },
    Cache: { Connector: 'RAM' },
    VectorDB: {
        Connector: 'RAMVec',
        Settings: {
            embeddings: {
                provider: 'openai',
                model: 'text-embedding-3-small',
            },
        },
    },
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            shared: 'development',
        },
    },
});
```

### Custom Production Setup

```typescript
SRE.init({
    Storage: {
        Connector: 'S3',
        Settings: {
            region: 'us-east-1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            bucket: 'production-storage',
        },
    },
    Cache: {
        Connector: 'Redis',
        Settings: {
            name: 'mymaster',
            password: process.env.REDIS_PASSWORD,
            hosts: 'localhost:6379',
        },
    },
    VectorDB: {
        Connector: 'Pinecone',
        Settings: {
            apiKey: process.env.PINECONE_API_KEY,
            indexName: 'production-index',
            embeddings: {
                provider: 'openai',
                model: 'text-embedding-3-small',
            },
        },
    },
    Vault: {
        Connector: 'SecretsManager',
        Settings: {
            region: 'us-east-1',
            awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
            awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    },
});
```

## See Also

-   [Connector Documentation](../connectors/README.md) - Complete connector reference
-   [Configuration Guide](../05-configuration.md) - Detailed configuration options
-   [Security Guide](../03-security.md) - Security considerations for production
