---
title: 'connectors/Components'
---

# Component Connectors

The Component subsystem manages loading and execution of SRE components and skills.

## Available Connectors

### LocalComponent

**Role**: Local component loader  
**Summary**: Loads and manages components from the local filesystem. Handles component discovery, loading, and lifecycle management from built-in components.

| Setting       | Type | Required | Default | Description                                                |
| ------------- | ---- | -------- | ------- | ---------------------------------------------------------- |
| _No settings_ | -    | -        | -       | LocalComponent connector takes no configuration parameters |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Component: {
        Connector: 'LocalComponent',
        Settings: {},
    },
});
```

**Use Cases:**

-   Loading built-in SRE components
-   Component discovery and registration
-   Component lifecycle management
-   Local development and testing

**How it Works:**

-   Automatically loads all built-in components from `ComponentInstances`
-   No external configuration required
-   Components are registered and made available to agents
-   Provides secure access control for component usage
