# Workflows

Complex behaviours are built by connecting components into a workflow. Components represent operations such as API calls, parsers and storage access. You can wire them in code or create them visually in the builder. [`examples/03-agent-workflow-components`](../../examples/03-agent-workflow-components/10-agent-workflow.ts) shows a programmatic example.

```typescript
import { Agent, Component } from '@smythos/sdk';

const agent = new Agent({ name: 'CryptoMarket Assistant', model: 'gpt-4o' });
const skill = agent.addSkill({ name: 'MarketData' });
skill.in({ coin_id: { description: 'The coin id' } });

const apiCall = Component.APICall({
    url: 'https://api.coingecko.com/api/v3/coins/{{coin_id}}',
    method: 'GET',
});
apiCall.in({ coin_id: skill.out.coin_id });

const output = Component.APIOutput({ format: 'minimal' });
output.in({ MarketData: apiCall.out.Response.market_data });
```

Workflows created in the builder can be exported as `.smyth` files and imported using the method from the previous chapter.

Next: [Services](07-services.md).
