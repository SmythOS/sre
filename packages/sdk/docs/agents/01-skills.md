# Agent Skills

Skills are the building blocks that give agents their capabilities. Each skill is a function that the agent's LLM can decide to call based on the user's prompt.

## How Agents Use Skills

When you send a prompt to an agent, its underlying Large Language Model (LLM) analyzes the request. It then looks at the list of available skills and, based on their `name` and `description`, determines which skill (if any) is best suited to fulfill the request. The LLM intelligently extracts the necessary parameters from your prompt and passes them to the skill's `process` function.

This is what makes agents so powerful: you provide the tools (skills), and the agent figures out how and when to use them.

## Adding Skills

You can add any number of skills to an agent using the `agent.addSkill()` method. A skill is defined by an object containing a `name`, a `description`, and a `process` handler.

-   `name`: A clear, simple name for the skill.
-   `description`: A crucial piece of text. The LLM relies heavily on the description to understand what the skill does. The more descriptive you are, the better the agent will be at using the skill correctly.
-   `process`: An `async` function that contains the logic of the skill. It receives an object with the parameters the LLM extracts from the prompt.

Here's a more detailed example of a `weather` skill:

```typescript
agent.addSkill({
    name: 'getWeather',
    description: 'Fetches the current weather for a specific city.',
    // The 'process' function receives the 'city' argument extracted by the LLM.
    process: async ({ city }) => {
        // In a real-world scenario, you would call a weather API here.
        console.log(`Fetching weather for ${city}...`);

        if (city.toLowerCase() === 'london') {
            return { temperature: '15°C', condition: 'Cloudy' };
        } else if (city.toLowerCase() === 'tokyo') {
            return { temperature: '28°C', condition: 'Sunny' };
        } else {
            return { error: 'City not found' };
        }
    },
});

// The agent's LLM will see this prompt and decide to use the 'getWeather' skill.
// It will also know to pass 'London' as the 'city' parameter.
const weatherReport = await agent.prompt('What is the weather like in London today?');

console.log(weatherReport);
// Expected output (will vary based on the model's formatting):
// "The weather in London is currently 15°C and cloudy."
```

## Defining Skill Inputs

For more precise control over what parameters the LLM passes to a skill, you can define typed inputs using the `.in()` method on the skill reference returned by `addSkill()`:

```typescript
const searchSkill = agent.addSkill({
    name: 'SearchProducts',
    description: 'Search for products in the catalog by keyword',
    process: async ({ query, category, maxResults }) => {
        // query, category, maxResults will be extracted by the LLM
        return await searchCatalog(query, category, maxResults);
    },
});

searchSkill.in({
    query: {
        type: 'Text',
        description: 'The search keyword or phrase',
    },
    category: {
        type: 'Text',
        description: 'Optional product category to filter by',
    },
    maxResults: {
        type: 'Number',
        description: 'Maximum number of results to return (default: 10)',
    },
});
```

## Direct Skill Invocation

Sometimes, you don't need the LLM's reasoning. If you know exactly which skill you want to execute and what parameters to use, you can call it directly using `agent.call()`.

This approach has two main advantages:

1.  **Speed**: It's much faster as it bypasses the LLM's analysis step.
2.  **Predictability**: It's deterministic. You get a direct, structured JSON response from the skill, not a natural language answer formatted by the LLM.

```typescript
// Bypassing the LLM to call the 'getWeather' skill directly.
const tokyoWeather = await agent.call('getWeather', { city: 'tokyo' });

console.log(tokyoWeather);
// Expected output:
// { temperature: '28°C', condition: 'Sunny' }
```

Using `agent.call()` is ideal when you need reliable data for the UI or other parts of your application, while `agent.prompt()` is best for creating conversational, AI-driven experiences.

## Next Steps

Now that you understand how to empower your agents with skills, explore how agents can operate in different execution modes with [Agent Modes](02-agent-modes.md).
