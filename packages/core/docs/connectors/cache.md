---
title: 'connectors/Cache'
---

# Cache Connectors

The Cache subsystem provides high-performance temporary data storage for frequently accessed information. It supports TTL (Time-To-Live) expiration, automatic cleanup, and various storage backends for different performance and scalability requirements.

## Available Connectors

### RAM

**Role**: In-memory cache connector  
**Summary**: Provides ultra-fast caching using process memory. Ideal for single-node applications requiring maximum performance with automatic memory management.

| Setting                | Type | Required | Default | Description                          |
| ---------------------- | ---- | -------- | ------- | ------------------------------------ |
| _No specific settings_ | any  | No       | -       | RAMCache accepts any settings object |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Cache: {
        Connector: 'RAM',
        Settings: {},
    },
});
```

**Use Cases:**

-   Single-node applications
-   Development and testing
-   Ultra-low latency requirements
-   Session storage
-   Temporary computation results

---

### Redis

**Role**: Redis-based distributed cache connector  
**Summary**: Provides scalable, distributed caching using Redis server. Supports clustering, persistence, and advanced data structures for high-performance applications.

| Setting    | Type                        | Required | Default | Description                                              |
| ---------- | --------------------------- | -------- | ------- | -------------------------------------------------------- |
| `name`     | string                      | Yes      | -       | Redis master name (for Sentinel mode)                    |
| `password` | string                      | Yes      | -       | Redis authentication password                            |
| `hosts`    | string \| string[] \| any[] | Yes      | -       | Redis host(s) - single host string or array for Sentinel |
| `prefix`   | string                      | No       | -       | Key prefix for namespace isolation                       |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Cache: {
        Connector: 'Redis',
        Settings: {
            name: 'mymaster',
            password: process.env.REDIS_PASSWORD,
            hosts: 'localhost:6379',
            prefix: 'myapp:cache:',
        },
    },
});
```

**Sentinel Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Cache: {
        Connector: 'Redis',
        Settings: {
            name: 'mymaster',
            password: process.env.REDIS_PASSWORD,
            hosts: ['sentinel1:26379', 'sentinel2:26379', 'sentinel3:26379'],
        },
    },
});
```

**Use Cases:**

-   Multi-node distributed applications
-   Production environments requiring persistence
-   Session sharing across instances
-   High-availability caching
-   Advanced data structure operations

---

### LocalStorage

**Role**: File-based cache connector  
**Summary**: Provides persistent caching using local filesystem storage. Suitable for applications requiring cache persistence across restarts without external dependencies.

| Setting  | Type   | Required | Default            | Description                    |
| -------- | ------ | -------- | ------------------ | ------------------------------ |
| `folder` | string | No       | `~/.smyth/storage` | Directory path for cache files |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Cache: {
        Connector: 'LocalStorage',
        Settings: {
            folder: './data/cache',
        },
    },
});
```

**Use Cases:**

-   Single-node applications requiring persistence
-   Development environments
-   Applications with intermittent connectivity
-   Cost-sensitive deployments
-   Simple deployment scenarios

---

### S3

**Role**: Amazon S3-based cache connector  
**Summary**: Provides cloud-based caching using Amazon S3 storage. Offers unlimited scalability with built-in durability and global accessibility.

| Setting           | Type   | Required | Default | Description                      |
| ----------------- | ------ | -------- | ------- | -------------------------------- |
| `bucketName`      | string | Yes      | -       | S3 bucket name for cache storage |
| `region`          | string | Yes      | -       | AWS region of the bucket         |
| `accessKeyId`     | string | Yes      | -       | AWS access key ID                |
| `secretAccessKey` | string | Yes      | -       | AWS secret access key            |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Cache: {
        Connector: 'S3',
        Settings: {
            bucketName: 'my-app-cache',
            region: 'us-east-1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    },
});
```

**Use Cases:**

-   Multi-region distributed applications
-   Serverless architectures
-   Applications requiring unlimited cache storage
-   Long-term cache persistence
-   Integration with AWS ecosystem

**Performance Notes:**

-   S3 cache has higher latency than memory/Redis-based solutions
-   Best suited for larger objects or infrequently accessed data
-   Consider using CloudFront for global distribution
-   Monitor S3 costs for high-frequency cache operations

## Configuration Notes

### Redis Configuration

-   When `hosts` is a single string, it's treated as a direct Redis connection
-   When `hosts` is an array, it's treated as Redis Sentinel configuration
-   The `name` field is required for Sentinel mode to identify the master
-   Password can also be provided via `REDIS_PASSWORD` environment variable
-   Hosts can also be provided via `REDIS_HOSTS` environment variable

### Environment Variables

The Redis connector supports these environment variables as fallbacks:

-   `REDIS_HOSTS` - Redis host(s) configuration
-   `REDIS_PASSWORD` - Redis authentication password
-   `REDIS_MASTER_NAME` - Redis master name for Sentinel mode
