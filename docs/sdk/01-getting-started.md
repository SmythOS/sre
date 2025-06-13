# Getting Started

This introduction walks you through installing the SDK and booting the Smyth Runtime Environment (SRE). The script in [`examples/01-agent-code-skill`](../../examples/01-agent-code-skill) mirrors the steps below.

## Installation

```bash
npm install @smythos/sdk
```

The default export automatically starts SRE with in-memory connectors so you can experiment right away. For a custom setup you may initialise SRE yourself and choose different connectors:

```typescript
import { SRE } from '@smythos/sre';

SRE.init({
    Cache: { Connector: 'RAM' },
    Storage: { Connector: 'Local' },
    Log: { Connector: 'ConsoleLog' },
});
```

## Your First Agent

Create an agent, register a skill and send a prompt. The model decides when to call your skill based on the user's question.

```typescript
import { Agent } from '@smythos/sdk';

const agent = new Agent({
    name: 'CryptoMarket Assistant',
    behavior: 'Track crypto prices',
    model: 'gpt-4o',
});

agent.addSkill({
    name: 'MarketData',
    description: 'Get cryptocurrency market data',
    process: async ({ coin_id }) => {
        // fetch from CoinGecko
    },
});

const result = await agent.prompt('What are the current prices of Bitcoin and Ethereum?');
console.log(result);
```

Move on to [Building Agents](02-agents.md) to organise multiple skills and call them directly.
