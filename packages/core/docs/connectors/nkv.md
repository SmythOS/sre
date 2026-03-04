---
title: 'connectors/NKV (Named Key-Value)'
---

# NKV (Named Key-Value) Connectors

The NKV (Named Key-Value) subsystem provides persistent key-value storage with namespace support. It serves as a general-purpose data store for application state, configuration data, and structured information.

## Available Connectors

### LocalStorage

**Role**: File-based NKV connector  
**Summary**: Provides persistent key-value storage using local filesystem with JSON serialization. Ideal for single-node applications requiring simple data persistence.

| Setting  | Type   | Required | Default            | Description                     |
| -------- | ------ | -------- | ------------------ | ------------------------------- |
| `folder` | string | No       | `~/.smyth/storage` | Directory path for data storage |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    NKV: {
        Connector: 'LocalStorage',
        Settings: {
            folder: './data/nkv',
        },
    },
});
```

**Use Cases:**

-   Single-node applications
-   Development and testing
-   Configuration data storage
-   Application state persistence
-   Small datasets requiring simple access

---

### Redis

**Role**: Redis-based NKV connector  
**Summary**: Provides high-performance key-value storage using Redis server. Uses the underlying Redis cache connector for actual storage operations.

| Setting                | Type | Required | Default | Description                                           |
| ---------------------- | ---- | -------- | ------- | ----------------------------------------------------- |
| _No specific settings_ | any  | No       | -       | NKVRedis uses the Redis cache connector configuration |

**Configuration**: NKV Redis connector delegates to the Redis cache connector. Configure Redis settings through the Cache subsystem.

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    NKV: {
        Connector: 'Redis',
        Settings: {},
    },
    // Configure Redis through Cache subsystem
    Cache: {
        Connector: 'Redis',
        Settings: {
            name: 'mymaster',
            password: process.env.REDIS_PASSWORD,
            hosts: 'localhost:6379',
        },
    },
});
```

**Use Cases:**

-   High-performance applications
-   Multi-node distributed systems
-   Real-time data requirements
-   Session storage and caching
-   Applications requiring advanced data structures

---

### RAM

**Role**: In-memory NKV connector  
**Summary**: Provides ultra-fast key-value storage using process memory. Data is lost on application restart but offers maximum performance for temporary data.

| Setting                | Type | Required | Default | Description                        |
| ---------------------- | ---- | -------- | ------- | ---------------------------------- |
| _No specific settings_ | any  | No       | -       | NKVRAM accepts any settings object |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    NKV: {
        Connector: 'RAM',
        Settings: {},
    },
});
```

**Use Cases:**

-   Temporary data storage
-   High-performance caching
-   Development and testing
-   Session state management
-   Real-time processing workflows

## NKV Operations

All NKV connectors support these standard operations:

| Operation                    | Description                         |
| ---------------------------- | ----------------------------------- |
| `get(namespace, key)`        | Retrieve value by namespace and key |
| `set(namespace, key, value)` | Store value with namespace and key  |
| `delete(namespace, key)`     | Remove key from namespace           |
| `exists(namespace, key)`     | Check if key exists in namespace    |
| `list(namespace)`            | List all keys in namespace          |
| `listNamespaces()`           | List all available namespaces       |
| `clear(namespace)`           | Remove all keys from namespace      |
| `size(namespace)`            | Get number of keys in namespace     |

## Data Types and Serialization

NKV connectors automatically handle serialization for various data types:

| Data Type   | Support | Notes                  |
| ----------- | ------- | ---------------------- |
| `string`    | ✅      | Native storage         |
| `number`    | ✅      | Preserved as numeric   |
| `boolean`   | ✅      | Native boolean support |
| `object`    | ✅      | JSON serialization     |
| `array`     | ✅      | JSON serialization     |
| `Date`      | ✅      | ISO string conversion  |
| `Buffer`    | ✅      | Base64 encoding        |
| `undefined` | ❌      | Stored as `null`       |
| `function`  | ❌      | Not supported          |

## Namespace Best Practices

### Naming Conventions

-   Use descriptive namespace names
-   Follow consistent naming patterns
-   Use hierarchical names with separators (e.g., `app:config:database`)
-   Avoid special characters in namespace names

### Organization Strategies

```typescript
// Feature-based namespaces
'user:profiles';
'user:preferences';
'user:sessions';

// Environment-based namespaces
'prod:config';
'dev:config';
'test:config';

// Component-based namespaces
'auth:tokens';
'cache:api';
'queue:jobs';
```

## Performance Considerations

### LocalStorage

-   Fast for small to medium datasets
-   File I/O operations can be slow for large datasets
-   Consider SSD storage for better performance
-   Batch operations when possible

### Redis

-   Excellent performance for most operations
-   Network latency affects performance
-   Uses the configured Redis cache connector
-   Inherits Redis cache connector's connection pooling and clustering

### RAM

-   Ultra-fast performance
-   Limited by available memory
-   Data lost on application restart
-   Monitor memory usage to prevent OOM errors

## Integration Examples

### Multi-Environment Setup

```typescript
import { SRE } from '@smythos/sre';

// Development
SRE.init({
    NKV: {
        Connector: 'LocalStorage',
        Settings: {
            folder: './dev-data',
        },
    },
});

// Production
SRE.init({
    NKV: {
        Connector: 'Redis',
        Settings: {},
    },
});
```

### Redis Configuration

Since NKV Redis uses the Cache Redis connector, configure Redis through the Cache subsystem:

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Cache: {
        Connector: 'Redis',
        Settings: {
            name: 'mymaster',
            password: process.env.REDIS_PASSWORD,
            hosts: process.env.REDIS_HOSTS,
            prefix: 'myapp:',
        },
    },
    NKV: {
        Connector: 'Redis',
        Settings: {},
    },
});
```
