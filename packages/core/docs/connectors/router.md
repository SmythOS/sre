---
title: 'connectors/Router'
---

# Router Connectors

The Router subsystem provides HTTP routing and API endpoint management.

## Available Connectors

### ExpressRouter

**Role**: Express.js-based HTTP router  
**Summary**: Provides HTTP routing using Express.js framework with middleware support, route handling, and API management.

| Setting   | Type   | Required | Default | Description             |
| --------- | ------ | -------- | ------- | ----------------------- |
| `router`  | Router | Yes      | -       | Express Router instance |
| `baseUrl` | string | Yes      | -       | Base URL for the router |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';
import express from 'express';

const router = express.Router();

SRE.init({
    Router: {
        Connector: 'ExpressRouter',
        Settings: {
            router: router,
            baseUrl: 'https://api.example.com',
        },
    },
});
```

**Use Cases:**

-   HTTP API endpoints
-   Express.js applications
-   RESTful services
-   Middleware integration
-   Route management

---

### NullRouter

**Role**: No-operation router connector  
**Summary**: Provides a null implementation that discards all routing operations. Used when HTTP routing is not needed.

| Setting                | Type | Required | Default | Description                            |
| ---------------------- | ---- | -------- | ------- | -------------------------------------- |
| _No specific settings_ | any  | No       | -       | NullRouter accepts any settings object |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Router: {
        Connector: 'NullRouter',
        Settings: {},
    },
});
```

**Use Cases:**

-   Applications without HTTP endpoints
-   Testing environments
-   CLI applications
-   Background services
-   Development with external routing

**How it Works:**

-   All routing operations are logged and ignored
-   Provides a base URL of `http://nullrouter.local`
-   No actual HTTP server is started
-   Useful for disabling HTTP functionality
