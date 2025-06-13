# Streaming Responses

Streaming lets you react to model output as soon as it is generated. Instead of waiting for the entire response you can display tokens in real time. The script [`02-streaming.ts`](../../examples/01-agent-code-skill/02-streaming.ts) demonstrates this behaviour.

```typescript
const stream = await agent
    .prompt('Give me the current price of Bitcoin.')
    .stream();

stream.on(TLLMEvent.Content, (chunk) => process.stdout.write(chunk));
stream.on(TLLMEvent.End, () => console.log('\nDone'));
```

The event emitter also exposes `ToolCall` and `ToolResult` events so you can show when your skills run and what they return.

Next: [Conversations](04-chat.md).
