# Building Agents

With the basics in place you can start expanding your agent with skills. Each skill exposes a function the model can invoke when needed. The example scripts in [`examples/01-agent-code-skill`](../../examples/01-agent-code-skill) illustrate these concepts.

## Adding Skills

A skill is defined with a name, description and `process` handler. Inputs declared on the skill are validated automatically.

```typescript
agent.addSkill({
    name: 'Price',
    description: 'Return the price of a cryptocurrency',
    process: async ({ coin_id }) => {
        // fetch the current price
    },
});
```

Multiple skills can be registered on the same agent. When you call `agent.prompt()` the model chooses which skill to execute based on the question.

## Direct Invocation

Skills are not limited to model calls—you can execute them yourself and use the returned JSON data.

```typescript
const price = await agent.call('Price', { coin_id: 'bitcoin' });
```

See [01-prompting.ts](../../examples/01-agent-code-skill/01-prompting.ts) for a working script.

Next: [Streaming Responses](03-streaming.md).
