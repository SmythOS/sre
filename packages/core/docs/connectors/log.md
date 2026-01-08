---
title: 'connectors/Logging'
---

# Log Connectors

The Log subsystem handles application logging and monitoring.

## Available Connectors

### ConsoleLog

**Role**: Console-based logging connector  
**Summary**: Outputs log messages to the console. Suitable for development and simple deployments.

| Setting       | Type | Required | Default | Description                                            |
| ------------- | ---- | -------- | ------- | ------------------------------------------------------ |
| _No settings_ | -    | -        | -       | ConsoleLog connector takes no configuration parameters |

**Example Configuration:**

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Log: {
        Connector: 'ConsoleLog',
        Settings: {},
    },
});
```

**Use Cases:**

-   Development and testing
-   Simple deployments
-   Local debugging
-   Container-based applications
-   Applications using external log aggregation

**How it Works:**

-   Logs agent calls and task consumption
-   Uses the SRE Logger system for structured output
-   Outputs debug-level messages to console
-   Automatically includes agent IDs and context
-   No external dependencies required
