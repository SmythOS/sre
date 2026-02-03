# Building with Workflows and Components

While `addSkill` with a `process` function is great for many use cases, the SmythOS SDK provides an even more powerful, declarative way to build complex logic: **Workflows**.

Workflows allow you to construct an agent's skills by wiring together pre-built `Components` in a data-flow paradigm. This is the same system used by the visual SmythOS Builder, meaning you can programmatically create workflows that are visually representable and vice-versa.

The script in [`examples/03-agent-workflow-components`](https://github.com/SmythOS/sre/blob/main/examples/03-agent-workflow-components/) demonstrates this programmatic approach.

## The Core Idea: Wiring Components

Instead of writing a monolithic `process` function, you define a skill as a chain of `Components`. Each component is a small, reusable unit that performs a single task (e.g., make an API call, transform data, access storage).

You connect these components by wiring the **output** of one component to the **input** of another.

-   `component.in`: Defines the input data a component expects.
-   `component.out`: Exposes the data a component produces.

## Example: Building a Skill with a Workflow

Let's rebuild the `MarketData` skill from the previous guides, but this time using a workflow instead of a `process` function.

The goal is the same: take a `coin_id`, call the CoinGecko API, and return the market data.

```typescript
import { Agent, Component } from '@smythos/sdk';

// 1. Create the agent and the skill placeholder
//    Note that we don't provide a 'process' function here.
const agent = new Agent({ name: 'CryptoMarket Assistant', model: 'gpt-4o' });
const skill = agent.addSkill({
    name: 'MarketData',
    description: 'Get cryptocurrency market data for a given coin ID.',
});

// 2. Define the skill's input
//    This tells the agent what arguments to expect for this skill.
//    The 'coin_id' will be extracted from the user's prompt.
skill.in({
    coin_id: { description: 'The official ID of the cryptocurrency (e.g., bitcoin)' },
});

// 3. Create the API Call Component
//    This component is responsible for making the HTTP request.
//    Notice the '{{coin_id}}' placeholder in the URL.
const apiCall = Component.APICall({
    url: 'https://api.coingecko.com/api/v3/coins/{{coin_id}}',
    method: 'GET',
});

// 4. Wire the skill's input to the API call's input
//    We connect the 'coin_id' from the skill's input (skill.out.coin_id)
//    to the 'coin_id' placeholder in the API call's URL.
apiCall.in({ coin_id: skill.out.coin_id });

// 5. Create the Output Component
//    This component defines what data the skill should ultimately return.
const output = Component.SkillOutput();

// 6. Wire the API call's output to the skill's output
//    The API call component's output (`apiCall.out.Response`) contains the entire API response.
//    We want to extract just the 'market_data' field and return it as the skill's result.
output.in({
    result: apiCall.out.Response.market_data,
});

// Now the skill is fully defined and ready to be used by the agent,
// either through a prompt or a direct .call().
const result = await agent.call('MarketData', { coin_id: 'ethereum' });
console.log('Current Price (USD):', result.current_price.usd);
```

This declarative, component-based approach makes complex skills easier to manage, debug, and visualize. You can see the clear flow of data from the initial input, through the API call, and to the final output.

## Exporting Workflows

Just like agents, workflows created in the SmythOS Builder can be exported as `.smyth` files. You can then use `Agent.import()` to load these complex, visually-designed workflows into your application.

## Next Steps

You've now seen the most advanced way to build agent capabilities. Next, let's look at how the SDK integrates with external services through [Services](07-services.md).
