# Model

`Model` is similar to `LLM` but returns a model configuration object rather than an executable instance. Use it when importing workflows from `.smyth` files.

```typescript
import { Model, Agent } from '@smythos/sdk';

const agent = Agent.import('agent.smyth', {
    model: Model.OpenAI('gpt-4o')
});
```
