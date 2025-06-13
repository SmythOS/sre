# Component and Skill

The `Component` namespace exposes factory functions to build workflow components. `Skill` is a special component that defines an entry point for the agent.

```typescript
import { Component } from '@smythos/sdk';

const apiCall = Component.APICall({ url: 'https://api.coingecko.com/api/v3/coins/{{id}}' });
const output = Component.APIOutput({ format: 'minimal' });
```

Use these together with `ComponentWrapper` to wire custom workflows.
