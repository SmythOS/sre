# Building Agents with Skills

Now that you've created a basic agent, it's time to expand its capabilities by adding skills. Skills are the fundamental building blocks for making your agents useful. They are functions that the agent's language model can call upon to perform specific tasks, like retrieving data, interacting with APIs, or performing calculations.

The example scripts in [`examples/01-agent-code-skill`](https://github.com/SmythOS/sre/blob/main/examples/01-agent-code-skill) provide hands-on illustrations of all the concepts covered here.

## How Agents Use Skills

When you send a prompt to an agent, its underlying Large Language Model (LLM) analyzes the request. It then looks at the list of available skills and, based on their `name` and `description`, determines which skill (if any) is best suited to fulfill the request. The LLM intelligently extracts the necessary parameters from your prompt and passes them to the skill's `process` function.

This is what makes agents so powerful: you provide the tools (skills), and the agent figures out how and when to use them.

## Agent mode

The agent mode is a way to add specific behavior and capabilities to the agent.
Currently, there are two modes available:

-   `default`: The agent relies only on the behavior and the skills that you provided. this is the default mode and gives you full control over the agent's behavior.
-   `planner`: When enabled, The agent gain the ability to split complex jobs into tasks and subtasks, track them, report their status to the user, and perform the tasks one by one. (see [Planner Mode Example](https://github.com/SmythOS/sre/blob/main/examples/01-agent-code-skill/04.1-chat-planner-coder.ts) for more details)

switching agent mode is very simple.
when you initialize the agent, you can set the mode by passing the `mode` parameter.

```typescript
const agent = new Agent({
    //... other agent settings
    mode: TAgentMode.PLANNER,
});
```

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

Now that you understand how to empower your agents with skills, let's explore how to create more dynamic and interactive experiences with [Streaming Responses](03-streaming.md).
