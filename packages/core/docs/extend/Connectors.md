---
title: 'extend/Custom Connectors'
---

# 🔌 Extending SRE: Building Custom Connectors

> **Extend the Runtime with Custom Service Implementations**

The Smyth Runtime Environment (SRE) is built on a **connector-based architecture** that allows you to seamlessly integrate with virtually any external service or technology. Whether you need to add support for a new database, cloud provider, or custom API, SRE's extensible connector system makes it straightforward.

## 🏗️ Service Architecture Overview

Every SRE service follows a consistent **three-layer architecture** that ensures modularity, security, and maintainability:

```
┌─────────────────────────────────────┐
│          Service Layer           │ ← Registration & Management
├─────────────────────────────────────┤
│       Abstract Connector         │ ← Interface Definition
├─────────────────────────────────────┤
│    Concrete Implementations      │ ← Your Custom Connectors
│  [Redis] [S3] [Local] [Custom...]│
└─────────────────────────────────────┘
```

## 📁 Typical Service Structure

All SRE services follow the same organized directory structure under `/src/subsystems/<category>/<servicename>.service/`:

```
Storage.service/
├── index.ts                    # Service registration
├── StorageConnector.ts         # Abstract connector interface
├── connectors/                 # Concrete implementations
│   ├── LocalStorage.class.ts   # Local filesystem connector
│   ├── S3Storage.class.ts      # AWS S3 connector
│   └── [YourCustom].class.ts   # Your custom connector
└── [Service-specific helpers]  # Optional utility files
```

### 🎯 Core Components

#### 1. **Service Registration** (`index.ts`)

The service entry point that registers all available connectors with the SRE runtime:

```typescript
import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { LocalStorage } from './connectors/LocalStorage.class';
import { S3Storage } from './connectors/S3Storage.class';

export class StorageService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Storage, 'LocalStorage', LocalStorage);
        ConnectorService.register(TConnectorService.Storage, 'S3', S3Storage);
        // Your custom connector would go here:
        // ConnectorService.register(TConnectorService.Storage, 'MyCustom', MyCustomStorage);
    }
}
```

**Key Features:**

-   **🔧 Centralized Registration**: All connectors for a service registered in one place
-   **🏷️ Naming Convention**: Each connector gets a unique string identifier
-   **🔗 Type Safety**: Strongly typed service categories via `TConnectorService`
-   **📦 Lazy Loading**: Connectors instantiated only when needed

#### 2. **Abstract Connector Interface** (`<Service>Connector.ts`)

Defines the contract that all concrete implementations must follow:

```typescript
export interface IStorageRequest {
    read(resourceId: string): Promise<StorageData>;
    write(resourceId: string, value: StorageData, acl?: IACL, metadata?: StorageMetadata): Promise<void>;
    delete(resourceId: string): Promise<void>;
    exists(resourceId: string): Promise<boolean>;
    // ... additional methods
}

export abstract class StorageConnector extends SecureConnector {
    // Security-aware abstract methods that implementations must provide
    protected abstract read(acRequest: AccessRequest, resourceId: string): Promise<StorageData>;
    protected abstract write(acRequest: AccessRequest, resourceId: string, value: StorageData, acl?: IACL, metadata?: StorageMetadata): Promise<void>;

    // Public interface that handles security automatically
    public requester(candidate: AccessCandidate): IStorageRequest {
        return {
            read: async (resourceId: string) => {
                return await this.read(candidate.readRequest, resourceId);
            },
            write: async (resourceId: string, value: StorageData, acl?: IACL, metadata?: StorageMetadata) => {
                return await this.write(candidate.writeRequest, resourceId, value, acl, metadata);
            },
            // ... other methods
        };
    }

    // Resource-level access control
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;
}
```

**Architecture Benefits:**

-   **🛡️ Built-in Security**: Every operation requires proper authorization through `AccessRequest`
-   **🔌 Unified Interface**: Consistent API across all connector implementations
-   **🎯 Clean Separation**: Public interface separate from protected implementation details
-   **📊 Resource-Level ACL**: Fine-grained access control per resource

#### 3. **Concrete Implementations** (`connectors/`)

Individual connector classes that implement the abstract interface for specific technologies:

```typescript
export class LocalStorage extends StorageConnector {
    public name = 'LocalStorage';
    private folder: string;

    constructor(settings: LocalStorageConfig) {
        super();
        this.folder = settings.folder || path.join(os.tmpdir(), '.smyth/storage');
        this.initialize();
    }

    // Implement all abstract methods with @SecureConnector.AccessControl decoration
    @SecureConnector.AccessControl
    protected async read(acRequest: AccessRequest, resourceId: string): Promise<StorageData> {
        // Your implementation here
        const filePath = this.getStorageFilePath(acRequest.candidate.id, resourceId);
        return fs.readFileSync(filePath, 'utf-8');
    }

    // Access control implementation
    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        // Determine resource permissions based on your storage system
        // Return appropriate ACL for the resource and candidate
    }
}
```

**Implementation Features:**

-   **🎨 Flexible Configuration**: Constructor accepts connector-specific settings
-   **🔒 Automatic Security**: `@SecureConnector.AccessControl` decorator enforces access control
-   **📍 Resource Isolation**: Each candidate gets isolated resource access based on their identity
-   **⚡ Performance Optimized**: Implementations can add caching, pooling, etc.

## 🔑 Key Architectural Principles

### 🛡️ Security-First Design

Every SRE connector operates within the **Candidate/ACL security model**:

-   **🎫 Access Candidates**: Every request comes with an authenticated candidate (agent, user, system)
-   **📋 Access Control Lists**: Resources have fine-grained permissions per candidate
-   **🔐 Request Authorization**: All operations validated through `AccessRequest` objects
-   **🚫 Fail-Safe Defaults**: Missing ACLs default to secure (no access)

### 🔌 Pluggable Architecture

-   **🔄 Hot-Swappable**: Change connectors without modifying business logic
-   **⚙️ Configuration-Driven**: Switch implementations via SRE initialization config
-   **🧩 Mix-and-Match**: Different connectors for different environments (dev/staging/prod)
-   **📈 Scaling Strategy**: Start simple, upgrade to enterprise solutions seamlessly

### 🎯 Consistent Patterns

All services follow identical patterns for:

-   **📝 Error Handling**: Consistent exception types and logging
-   **📊 Metadata Management**: Standardized metadata storage and retrieval
-   **⏰ TTL Support**: Time-to-live functionality where applicable
-   **🔍 Resource Discovery**: Unified approaches to listing and querying resources

## 🎪 Service Categories

SRE organizes connectors into **logical subsystems**, each serving specific runtime needs:

| Subsystem            | Services                                 | Purpose                         |
| -------------------- | ---------------------------------------- | ------------------------------- |
| **🔄 IO**            | Storage, VectorDB, Log, Router, NKV, CLI | External data and communication |
| **🧠 LLMManager**    | Models, Providers                        | AI model access                 |
| **🔐 Security**      | Vault, Account                           | Authentication and secrets      |
| **💾 MemoryManager** | Cache                                    | Performance optimization        |
| **🤖 AgentManager**  | Agents, Components                       | Agent execution                 |

Each subsystem contains multiple services, and each service supports multiple connector implementations, giving you maximum flexibility in how you architect your AI agent infrastructure.

---

_Ready to build your first custom connector? The next sections will walk you through implementation step-by-step._

# Extending SRE: Custom Connectors

One of the most powerful features of the Smyth Runtime Environment is its modular, connector-based architecture. You can extend the SRE to support new services (like a different database, storage provider, or LLM) by creating your own custom connectors.

## Connector Development Flow

Developing a new connector involves three main steps:

### 1. Implement the Interface

Every connector type in SRE has a corresponding interface that defines the required methods and properties. Your first step is to create a new class that implements the appropriate interface.

For example, to create a new storage connector, you would implement `IStorageConnector`.

```typescript
import { IStorageConnector, TStorageConfig } from '@smythos/sre';

export class MyCustomStorageConnector implements IStorageConnector {
    private settings: TStorageConfig;

    constructor(settings: TStorageConfig) {
        this.settings = settings;
    }

    async init(): Promise<void> {
        // Initialization logic for your connector,
        // like connecting to the database or authenticating.
        console.log('MyCustomStorageConnector initialized!');
    }

    // ... implement all other required methods from IStorageConnector
    // (e.g., read, write, delete, list)
}
```

### 2. Register the Connector

Once your connector class is created, you need to register it with the SRE's `ConnectorService`. This makes the runtime aware of your new connector and allows it to be selected in the configuration.

Registration is typically done in a central initialization file.

```typescript
import { ConnectorService, TConnectorService } from '@smythos/sre';
import { MyCustomStorageConnector } from './my-custom-storage.connector';

// Register the new connector with a unique name
ConnectorService.register(
    TConnectorService.Storage,
    'MyCustomStorage', // This is the name you'll use in the config
    MyCustomStorageConnector
);
```

### 3. Use the Connector in Configuration

After registration, you can now use your custom connector in the SRE configuration file just like any built-in connector.

```typescript
// in your SRE initialization
SRE.init({
    // ... other services
    Storage: {
        Connector: 'MyCustomStorage', // Use the name you registered
        Settings: {
            // any custom settings your connector needs
            endpoint: 'https://my.custom.storage/api',
        },
    },
    // ...
});
```
