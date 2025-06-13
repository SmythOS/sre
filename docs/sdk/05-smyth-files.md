# Loading `.smyth` Files

Agents designed visually in the SmythOS Builder can be exported as `.smyth` workflow files. Importing such a file recreates the entire workflow exactly as configured in the builder. The script in [`examples/02-agent-smyth-file`](../../examples/02-agent-smyth-file) loads a sample crypto agent.

```typescript
import { Agent, Model } from '@smythos/sdk';
import path from 'path';

const agentPath = path.resolve('crypto-info-agent.smyth');
const agent = Agent.import(agentPath, { model: Model.OpenAI('gpt-4o') });

const result = await agent.prompt('What are the current prices of Bitcoin and Ethereum?');
console.log(result);
```

Next: [Workflows](06-workflows.md).
