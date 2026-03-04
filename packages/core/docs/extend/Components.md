---
title: 'extend/Custom Components'
---

# Extending SRE: Custom Components

Components are the building blocks of an agent's behavior. While SRE provides a rich library of standard components, you can easily create your own to encapsulate custom logic, integrate with unique services, or perform specialized tasks.

## Component Development

Creating a new component requires extending the base `Component` class and implementing the `process` method.

### The Base Component Class

The `Component` class provides the core structure that the SRE's Agent Manager uses to execute your logic.

```typescript
import { Component, Agent } from '@smythos/sre';

export class MyCustomComponent extends Component {
    /**
     * This is the main execution method for the component.
     * @param input - The data passed from the previous component in the workflow.
     * @param config - The component's static configuration from the agent definition.
     * @param agent - A reference to the parent agent, providing access to SRE services.
     * @returns The output of the component, which will be passed to the next component.
     */
    async process(input: any, config: any, agent: Agent): Promise<any> {
        // Your custom logic here.
        // You can use the agent object to access SRE services.
        // For example, to write to storage:
        // await agent.SRE.IO.Storage.write('output.txt', 'Hello from my component!');

        const result = {
            ...input,
            processedBy: 'MyCustomComponent',
            timestamp: new Date(),
        };

        return result;
    }
}
```

### Registration

Similar to connectors, components must be registered with the `ComponentService` so the Agent Manager can find and execute them.

```typescript
import { ComponentService } from '@smythos/sre';
import { MyCustomComponent } from './my-custom.component';

// Register the component with a unique name
ComponentService.register(
    'MyCustomComponent', // The name used in the agent definition
    MyCustomComponent
);
```

Once registered, you can use `"MyCustomComponent"` in your agent's component workflow definitions.
