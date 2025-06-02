# Smyth Runtime Code Standards & Best Practices

> **!!! IMPORTANT !!! This is a work in progress code, many structure may change or get removed**

## Folder Structure

- **/IO**: Input/Output services. This folder contains classes that perform input/output operations to external resources such as Storage, Database, VectorDB, network, etc.
    - **/IO/\*/connector**: This subfolder contains connectors for different I/O services. For example, /IO/Storage/connectors contains classes that implement storage interfaces for specific storage systems like S3, local drive, etc.
- **/AM**: Agent Management services. This folder contains classes that handle agent data, settings, and runtime.
- **/MM**: Memory Management services. This folder contains memory management tools and classes (RuntimeContext, LLMContext, Cache).
- **/Components**: Smyth OS Agents Components.
- **/utils**: This folder contains utility functions. Functions in this folder should not depend on other packages of the project outside of /utils/\*. These functions are reusable throughout the code.
- **/helpers**: This folder contains general helper classes/objects/structures. Unlike utils, helpers export an object that exposes a collection of functions specific to a given task.
- **/types**: This folder contains SmythOS-specific type declarations.

## Naming Standards

### Code Roles

- **Service**: A service is a top-level subsystem in SmythOS. We have three main service categories: Agent Management, Memory Management, and Input/Output. Files implementing a service should have a `.service.ts` extension.
- **Connector/Manager**: These are classes that implement a specific service connector or manage a specific resource. They typically take a `.class.ts` extension as they are implemented as classes.
- **Utility**: A utility file is a collection of reusable general-purpose functions. Files implementing these functions should have a `.utils.ts` extension.
- **Helper**: A helper is an object that exposes a collection of reusable functions dedicated to a specific task. Helpers can reuse utilities, but utilities should not reuse helpers. Helpers should not be "aware" of SmythOS context (e.g an ACL helper provides functions to check access rights, but it does not "know" that some smyth access right is higher than another, this specificity should be implemented elsewhere)
- **Handler**: Implements event handlers for a specific task.

### File Naming

Use the following extensions:

- `.class.ts` for classes
- `.service.ts` for services
- `.utils.ts` for utilities
- `.helper.ts` for helpers
- `.handler.ts` for handlers
- `.mw.ts` for middlewares

### Declaration Naming

This section describes the code declaration naming standards:

- **Constants**: Constants should use uppercase names with underscores (e.g., `MAX_RETRIES`, `API_ENDPOINT`).
- **Enums and Types**: Should start with `T` (e.g., `TAccessLevel`, `TRole`).
- **Interfaces**: Should start with `I` (e.g., `IStorageConnector`).
- **Classes**: Do not have a specific prefix character but should use CamelCase.

All structure names, except constants, should use CamelCase. When a prefix character is used, it should be a capital letter. For example, if `P` is a prefix, the name would be `PCamelCase`.

# Smyth Runtime Environment

## Installation

```bash
npm install smyth-runtime
```

## Usage

### Core Runtime

```typescript
import { SRE } from 'smyth-runtime';

const sre = SRE.init({
    // your configuration
});
```

### SDK Components

To avoid naming conflicts with internal classes, SDK components are available through the `SDK` namespace:

```typescript
import { SRE, SDK } from 'smyth-runtime';

// Initialize runtime
const sre = SRE.init({
    CLI: { Connector: 'CLI' },
    Vault: { Connector: 'JSONFileVault', Settings: { file: 'vault.json' } },
    Cache: { Connector: 'RAM' },
    Storage: { Connector: 'Local' },
    AgentData: { Connector: 'CLIAgentDataConnector' },
    Account: { Connector: 'DummyAccount', Settings: {} },
    Log: { Connector: 'ConsoleLog' },
});

await sre.ready();

// Use SDK components
const llm = new SDK.LLM('OpenAI', { model: 'gpt-4o' });
const agent = new SDK.Agent({
    name: 'MyAgent',
    model: 'gpt-4o',
    behavior: 'You are a helpful assistant',
});

// Stream LLM response
const eventEmitter = await llm.prompt('What is the capital of France?').stream();
eventEmitter.on('content', (content) => {
    console.log(content);
});

// Use Agent
const response = await agent.prompt('Hello!');
console.log(response);
```

### Why the SDK Namespace?

The SDK namespace (`SDK.Agent`, `SDK.LLM`) prevents naming conflicts with internal runtime classes that have the same names. This ensures:

- ✅ **No conflicts** - Your code works regardless of internal changes
- ✅ **Clear separation** - SDK vs runtime components are distinct
- ✅ **Single bundle** - No sourcemap conflicts or module resolution issues
- ✅ **Better performance** - One optimized bundle instead of multiple
