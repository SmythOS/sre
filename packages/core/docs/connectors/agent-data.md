---
title: 'connectors/Agent Data'
---

# AgentData Connectors

The AgentData subsystem manages agent-specific data persistence and state.

## Available Connectors

### Local

**Role**: Local agent data storage  
**Summary**: Stores agent data on the local filesystem with JSON serialization and file-based organization.

| Setting   | Type   | Required | Default | Description                               |
| --------- | ------ | -------- | ------- | ----------------------------------------- |
| `devDir`  | string | Yes      | -       | Directory path for development agent data |
| `prodDir` | string | Yes      | -       | Directory path for production agent data  |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    AgentData: {
        Connector: 'Local',
        Settings: {
            devDir: './agents/dev',
            prodDir: './agents/prod',
        },
    },
});
```

**Use Cases:**

-   File-based agent storage
-   Environment-specific agent configurations
-   Local development workflows
-   Agent data versioning
-   Simple agent management

---

### CLI

**Role**: Command-line agent data provider  
**Summary**: Provides agent data integration for CLI applications with interactive prompts and file-based workflows.

| Setting | Type                | Required | Default | Description                   |
| ------- | ------------------- | -------- | ------- | ----------------------------- |
| `args`  | Record<string, any> | Yes      | -       | Command-line arguments object |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    AgentData: {
        Connector: 'CLI',
        Settings: {
            args: process.argv, // or custom args object
        },
    },
});
```

**Use Cases:**

-   CLI applications
-   Command-line agent execution
-   Interactive agent selection
-   Development tools
-   Script automation

---

### NullAgentData

**Role**: No-operation agent data connector  
**Summary**: Provides a null implementation for agent data operations. Used when agent persistence is not required.

| Setting | Type                | Required | Default | Description                             |
| ------- | ------------------- | -------- | ------- | --------------------------------------- |
| `args`  | Record<string, any> | Yes      | -       | Arguments object (ignored but required) |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    AgentData: {
        Connector: 'NullAgentData',
        Settings: {
            args: {},
        },
    },
});
```

**Use Cases:**

-   Testing environments
-   Stateless applications
-   External agent management
-   Debugging agent issues
-   Minimal deployments

## Data Format

### Agent Data Files

Agent data files should be in `.smyth` format (JSON) and contain:

-   `id`: Agent identifier
-   `components`: Component configuration
-   Other agent-specific settings

### File Organization

-   Development and production environments use separate directories
-   Each agent has its own data file
-   Settings and configurations are indexed by agent ID
