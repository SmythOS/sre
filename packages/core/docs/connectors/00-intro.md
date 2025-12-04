---
title: 'connectors/Connectors Introduction'
---

# SRE Connectors Documentation

This directory contains comprehensive documentation for all Smyth Runtime Environment (SRE) connectors. Each connector provides a specific implementation for SRE subsystems, enabling different deployment scenarios and integration requirements.

## Overview

The SRE uses a connector-based architecture where each subsystem can be implemented using different connectors. This allows for flexible deployment configurations, from local development to enterprise production environments.

## Available Connector Documentation

### Core Infrastructure

-   **[Storage Connectors](./storage.md)** - File and blob storage (LocalStorage, S3)
-   **[Cache Connectors](./cache.md)** - High-performance caching (RAM, Redis, LocalStorage, S3)
-   **[VectorDB Connectors](./vectordb.md)** - Vector databases for embeddings (RAMVec, Pinecone, Milvus)
-   **[NKV Connectors](./nkv.md)** - Named Key-Value storage (LocalStorage, Redis, RAM)

### AI & LLM

-   **[LLM Connectors](./llm.md)** - Language model providers (OpenAI, Anthropic, Google AI, Groq, Bedrock, etc.)
-   **[ModelsProvider Connectors](./models-provider.md)** - Model configuration management (JSONModelsProvider)

### Security & Access

-   **[Vault Connectors](./vault.md)** - Secure secret storage (JSONFileVault, SecretsManager, NullVault)
-   **[Account Connectors](./account.md)** - User authentication and authorization (DummyAccount, AWSAccount, JSONFileAccount)
-   **[ManagedVault Connectors](./managed-vault.md)** - Enterprise secret management (SecretManagerManagedVault, NullManagedVault)

### System Services

-   **[Component Connectors](./component.md)** - Component loading and management (LocalComponent)
-   **[Code Connectors](./code.md)** - Code execution environments (AWSLambda)
-   **[Log Connectors](./log.md)** - Logging and monitoring (ConsoleLog)
-   **[Router Connectors](./router.md)** - HTTP routing and API management (ExpressRouter, NullRouter)
-   **[AgentData Connectors](./agent-data.md)** - Agent data persistence (Local, CLI, NullAgentData)

## Quick Reference

### Default Configuration

The SRE ships with the following default connectors:

| Subsystem          | Default Connector  | Purpose                          |
| ------------------ | ------------------ | -------------------------------- |
| **Vault**          | JSONFileVault      | Local encrypted secret storage   |
| **Account**        | DummyAccount       | Development user management      |
| **Cache**          | RAM                | In-memory caching                |
| **Storage**        | LocalStorage       | File storage on local filesystem |
| **Code**           | DummyConnector     | Placeholder code executor        |
| **NKV**            | LocalStorage       | Named key-value storage          |
| **VectorDB**       | RAMVec             | In-memory vector database        |
| **ModelsProvider** | JSONModelsProvider | JSON-based model configuration   |
| **AgentData**      | NullAgentData      | No-operation agent data          |
| **Component**      | LocalComponent     | Local component loading          |
| **ManagedVault**   | NullManagedVault   | No-operation managed secrets     |
| **Log**            | ConsoleLog         | Console logging output           |
| **Router**         | NullRouter         | No-operation HTTP routing        |

**Note**: LLM connectors are not included in the default configuration. They are configured dynamically through the ModelsProvider subsystem using `models.json` files.

### Environment-Based Selection

#### Development Environment

```typescript
{
  Vault: {
    Connector: 'JSONFileVault',
    Settings: { shared: 'development' }
  },
  Account: { Connector: 'DummyAccount' },
  Cache: { Connector: 'RAM' },
  Storage: { Connector: 'LocalStorage' },
  Code: { Connector: 'DummyConnector' },
  NKV: { Connector: 'LocalStorage' },
  VectorDB: {
    Connector: 'RAMVec',
    Settings: {
      embeddings: {
        provider: 'openai',
        model: 'text-embedding-3-small'
      }
    }
  },
  Component: { Connector: 'LocalComponent' },
  ModelsProvider: { Connector: 'JSONModelsProvider' },
  Log: { Connector: 'ConsoleLog' },
  Router: { Connector: 'NullRouter' },
  AgentData: { Connector: 'NullAgentData' },
  ManagedVault: { Connector: 'NullManagedVault' }
}
```

#### Production Environment

```typescript
{
  Vault: {
    Connector: 'SecretsManager',
    Settings: {
      region: 'us-east-1',
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  },
  Account: {
    Connector: 'AWSAccount',
    Settings: {
      region: 'us-east-1',
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      clientId: process.env.COGNITO_CLIENT_ID
    }
  },
  Cache: {
    Connector: 'Redis',
    Settings: {
      name: 'mymaster',
      password: process.env.REDIS_PASSWORD,
      hosts: 'localhost:6379'
    }
  },
  Storage: {
    Connector: 'S3',
    Settings: {
      region: 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      bucket: 'production-storage'
    }
  },
  VectorDB: {
    Connector: 'Pinecone',
    Settings: {
      apiKey: process.env.PINECONE_API_KEY,
      indexName: 'production-index',
      embeddings: {
        provider: 'openai',
        model: 'text-embedding-3-small'
      }
    }
  },
  Component: { Connector: 'LocalComponent' },
  ModelsProvider: { Connector: 'JSONModelsProvider' },
  Code: {
    Connector: 'AWSLambda',
    Settings: {
      region: 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  },
  Log: { Connector: 'ConsoleLog' },
  Router: {
    Connector: 'ExpressRouter',
    Settings: {
      router: expressApp,
      baseUrl: '/api'
    }
  },
  AgentData: {
    Connector: 'Local',
    Settings: {
      devDir: './agents',
      prodDir: '/opt/agents'
    }
  },
  ManagedVault: {
    Connector: 'SecretManagerManagedVault',
    Settings: {
      region: 'us-east-1',
      vaultName: 'production-vault',
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  }
}
```

## Connector Categories

### By Deployment Type

**Local/Development**

-   LocalStorage (Storage, NKV)
-   RAM (Cache, NKV, VectorDB)
-   JSONFileVault (Vault)
-   DummyAccount (Account)
-   ConsoleLog (Log)
-   LocalComponent (Component)
-   Null connectors (Router, AgentData, ManagedVault)

**Cloud/Production**

-   S3 (Storage, Cache)
-   Redis (Cache, NKV)
-   Pinecone (VectorDB)
-   SecretsManager (Vault, ManagedVault)
-   AWSAccount (Account)
-   Commercial LLM providers (OpenAI, Anthropic, etc.)
-   AWSLambda (Code)
-   ExpressRouter (Router)

**Self-Hosted**

-   LocalStorage + Redis
-   Milvus (VectorDB)
-   Self-hosted LLM endpoints

### By Performance Characteristics

**High Performance**

-   RAM (Cache, NKV)
-   Redis (Cache, NKV)
-   Groq (LLM)

**High Durability**

-   S3 (Storage, Cache)
-   SecretsManager (Vault)
-   Pinecone (VectorDB)

**Simple/Minimal**

-   LocalStorage (Storage, NKV)
-   JSONFileVault (Vault)
-   Null connectors (various)

## Configuration Best Practices

### Security

1. **Never store credentials in code** - Use environment variables or secure vaults
2. **Use appropriate connectors for environment** - Dummy connectors only for development
3. **Enable encryption** - Use encrypted storage connectors in production
4. **Implement proper access controls** - Configure IAM roles and policies

### Performance

1. **Choose connectors based on requirements** - Memory vs. durability trade-offs
2. **Configure appropriate limits** - Memory limits, connection pools, timeouts
3. **Use caching effectively** - Layer fast and durable storage appropriately
4. **Monitor resource usage** - Set up alerts for memory, disk, network usage

### Reliability

1. **Use redundant storage** - Cloud providers with built-in redundancy
2. **Configure retries and timeouts** - Handle network failures gracefully
3. **Implement backup strategies** - Regular backups for file-based connectors
4. **Test failover scenarios** - Verify behavior when connectors fail

## Getting Started

1. **Review the [initialization documentation](../initialization/00-intro.md)** for basic setup
2. **Choose appropriate connectors** for your deployment environment
3. **Read specific connector documentation** for detailed configuration options
4. **Start with default configuration** and customize as needed
5. **Test thoroughly** in development before deploying to production

## Extending Connectors

The SRE connector system is designed to be extensible. You can:

-   Create custom connectors for specific requirements
-   Extend existing connectors with additional functionality
-   Contribute new connectors to the SRE ecosystem

Refer to the [extending connectors documentation](../extend/Connectors.md) for implementation guidelines.

## Support

For questions about specific connectors:

1. Check the individual connector documentation
2. Review the configuration examples
3. Consult the SRE troubleshooting guide
4. Open an issue in the SRE repository
