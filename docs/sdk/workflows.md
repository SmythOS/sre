# Composing Workflows

Agents run workflows made of components. Each component exposes inputs and outputs that can be wired together.

```typescript
import { Agent, Component } from '@smythos/sdk';

const agent = new Agent({ name: 'MarketBot', model: 'gpt-4o' });
const skill = agent.addSkill({ name: 'MarketData' });
skill.in({ coin_id: { type: 'string', required: true } });

const apiCall = Component.APICall({
    url: 'https://api.coingecko.com/api/v3/coins/{{coin_id}}?market_data=true',
    method: 'GET'
});
apiCall.in({ coin_id: skill.out.coin_id });

const output = Component.APIOutput({ format: 'minimal' });
output.in({ MarketData: apiCall.out.Response.market_data });
```

Workflows can also be authored visually and exported as `.smyth` files for later use.
