---
title: "Components"
---

# SRE Component System

Components are the fundamental building blocks of an agent's behavior in SRE. An agent is essentially a workflow, or graph, of interconnected components. Each component is a self-contained unit of logic that performs a specific task.

## The Component Class

Every component in SRE inherits from the base `Component` class. This class provides the core structure and lifecycle methods that the Agent Manager uses to execute the component.

The most critical method in a component is `process()`.

```typescript
export class Component {
    // ... properties and other methods

    /**
     * This is the main execution method for the component.
     * @param input - The data passed from the previous component in the workflow.
     * @param config - The component's static configuration from the agent definition.
     * @param agent - A reference to the parent agent, providing access to SRE services.
     * @returns The output of the component, which will be passed to the next component.
     */
    async process(input: any, config: any, agent: Agent): Promise<any> {
        // Component logic goes here
    }
}
```

> _For the full source code, see `packages/core/src/Components/Component.class.ts`._

### Component Execution

When the Agent Manager executes a component, it invokes the `process` method, passing in:

1.  **Input**: The data produced by the upstream component(s) in the agent's workflow.
2.  **Config**: The static configuration for that component instance, as defined in the agent's design. This includes things like prompts for an LLM, URLs for an API call, etc.
3.  **Agent**: A reference to the agent instance itself. This is a powerful feature that allows a component to access all of SRE's core services (`agent.SRE.IO.Storage`, `agent.SRE.Memory.Cache`, etc.) to perform its task.

The data returned by the `process` method becomes the input for the next component in the workflow.

## Component Categories

SRE provides a rich library of over 40 standard components, which are organized into several categories:

-   **AI & LLM**: Components for interacting with Large Language Models (e.g., `GenAILLM`, `VisionLLM`).
-   **External Integration**: Components for connecting to external services (e.g., `APICall`, `WebSearch`, `WebScrape`).
-   **Data Processing**: Components for manipulating data (e.g., `DataSourceIndexer`, `JSONFilter`).
-   **Logic & Control Flow**: Components for directing the agent's workflow (e.g., `LogicAND`, `ForEach`).
-   **Storage & Files**: Components for interacting with the Storage service (e.g., `FileStore`).

This extensive library allows for the creation of complex agent behaviors through the visual composition of these standard blocks. Developers can also create new, custom components by extending the base `Component` class.
