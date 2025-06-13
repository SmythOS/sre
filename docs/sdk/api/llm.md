# LLM

`LLM` is a set of factory functions to create `LLMInstance` objects for different providers.

```typescript
import { LLM } from '@smythos/sdk';

const openai = LLM.OpenAI('gpt-4o');
const anthropic = LLM.Anthropic({ model: 'claude-3-sonnet', maxTokens: 1000 });
```

Each factory accepts either a model id and optional parameters or a full parameter object.
