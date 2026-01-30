# Managing Agents with `.smyth` Files

The SmythOS SDK introduces `.smyth` files to bridge the gap between visual agent design and code implementation. While you can define agents entirely in code, `.smyth` files—which are JSON exports from the SmythOS visual builder—offer a powerful way to represent an agent's structure, including its name, behavior, and skills.

This approach offers several advantages:

- **Visual Workflow:** It allows complex agent workflows to be visualized, making them easier to understand and manage, which is especially useful for critical processes.
- **Collaboration:** It facilitates collaboration between developers and non-developers. Product managers or designers can use the visual builder to create or modify agent logic, which developers can then import and extend in code.
- **Separation of Concerns:** It promotes a clean separation where the agent's high-level structure is defined in the `.smyth` file, and the application code handles the runtime logic and interaction.

The [`examples/02-agent-smyth-file`](https://github.com/SmythOS/sre/blob/main/examples/02-agent-smyth-file) directory contains a working example of this concept.

## The `.smyth` File Format

A `.smyth` file is a JSON file that describes the agent's configuration. The format is an export from the SmythOS builder, but you can create them by hand. Here's a simplified example of what `my-crypto-agent.smyth` might look like, containing two connected components for fetching a cryptocurrency price:

```jsonc
// my-crypto-agent.smyth
{
    "name": "Crypto Info Agent",
    "behavior": "You are a cryptocurrency information assistant that uses the CoinGecko API.",
    "defaultModel": "gpt-4",
    "components": [
        {
            "id": "CP001",
            "name": "APIEndpoint",
            "description": "Exposes an endpoint to get a crypto price.",
            "data": { "endpoint": "get_price", "method": "GET" },
            "inputs": [{ "name": "coin_id", "type": "String", "index": 0 }],
            "outputs": [
                { "name": "headers", "index": 0 },
                { "name": "body", "index": 1 },
                { "name": "query", "index": 2 },
                { "name": "query.coin_id", "index": 3 },
            ],
        },
        {
            "id": "CP002",
            "name": "APICall",
            "title": "CoinGecko Price",
            "description": "Calls the CoinGecko API to get the price.",
            "data": {
                "method": "GET",
                "url": "https://api.coingecko.com/api/v3/simple/price?ids={{coin_id}}&vs_currencies=usd",
            },
            "inputs": [{ "name": "coin_id", "type": "String", "index": 0 }],
        },
    ],
    "connections": [
        {
            "sourceId": "CP001",
            "sourceIndex": "query.coin_id",
            "targetId": "CP002",
            "targetIndex": "coin_id",
        },
    ],
}
```

## Importing an Agent

You can easily load an agent from a `.smyth` file using the static `Agent.import()` method. This method is asynchronous and returns a fully hydrated `Agent` instance, ready to be used.

```typescript
import { Agent } from '@smythos/sdk';
import path from 'path';

async function main() {
    // Construct the full path to your .smyth file
    const agentPath = path.resolve(__dirname, 'my-crypto-agent.smyth');

    console.log(`Importing agent from: ${agentPath}`);

    // Import the agent definition from the file
    const agent = await Agent.import(agentPath);

    // Now you can interact with the agent as usual
    const response = await agent.prompt('What is the price of bitcoin?');
    console.log(response); // Outputs the price of Bitcoin.
}

main();
```

## Overriding Configuration

A key feature of `Agent.import()` is the ability to override any property of the `.smyth` file at load time. This is extremely useful for adapting a single agent definition to different environments or for using more powerful models.

For instance, you can override the `defaultModel` to use a different LLM without touching the original `.smyth` file.

```typescript
import { Agent, Model } from '@smythos/sdk';
import path from 'path';

async function main() {
    const agentPath = path.resolve(__dirname, 'my-crypto-agent.smyth');

    // Import the agent, but override the model to use gpt-4o
    const agent = await Agent.import(agentPath, {
        // The second argument to import() is an override object
        defaultModel: 'gpt-4o',
    });

    console.log(`Agent model is now: ${agent.data.defaultModel}`);

    const response = await agent.prompt('What is the price of ethereum?');
    console.log(response); // Outputs the price of Ethereum.
}

main();
```

Using `.smyth` files allows for a modular and maintainable architecture, making it easy to manage and version your agent designs separately from your application logic.

## Next Steps

Now that you can manage agents as files, let's explore how to orchestrate multiple agents and components together in [Workflows](06-workflows.md).
