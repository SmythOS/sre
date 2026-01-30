# Streaming Responses

For building dynamic, real-time applications, waiting for an agent's full response can lead to a slow user experience. The SmythOS SDK solves this with streaming, allowing you to process the agent's output token-by-token as it's generated. This is perfect for creating "typewriter" effects in UIs and providing immediate feedback to the user.

The script in [`examples/01-agent-code-skill/02-streaming.ts`](https://github.com/SmythOS/sre/blob/main/examples/01-agent-code-skill/02-streaming.ts) provides a complete, runnable example of the concepts below.

## How Streaming Works

Instead of `await`-ing the `agent.prompt()` call directly, you chain the `.stream()` method. This doesn't return the final string response. Instead, it returns a standard Node.js `EventEmitter` that you can subscribe to.

This `EventEmitter` will emit different events during the lifecycle of the agent's response generation, as defined in the `TLLMEvent` enum.

## Basic Streaming: Content and End Events

The most common use case is to listen for content chunks and the end of the stream.

- `TLLMEvent.Content`: This event fires whenever a new chunk of text (usually a word or a few tokens) is available from the LLM.
- `TLLMEvent.End`: This event fires once the entire response has been generated and the stream is closed.
- `TLLMEvent.Error`: This event fires if an error occurs during generation.

Here's how you can use it to print a response to the console in real-time:

```typescript
import { Agent, TLLMEvent } from '@smythos/sdk';

const agent = new Agent({
    name: 'Storyteller',
    model: 'gpt-4o',
    behavior: 'You are a master storyteller who weaves short, captivating tales.',
});

/*... implement skills here ...*/

// Chain .stream() to the prompt command
const stream = await agent.prompt('Tell me a short story about a robot who discovers music.').stream();

console.log('Storyteller is thinking...');

// Listen for the 'content' event to get text chunks
stream.on(TLLMEvent.Content, (chunk) => {
    // Write each piece of the story to the console as it arrives
    process.stdout.write(chunk);
});

// Listen for the 'end' event to know when the story is complete
stream.on(TLLMEvent.End, () => {
    console.log('\n\n--- The End ---');
});

// Always good practice to handle potential errors
stream.on(TLLMEvent.Error, (err) => {
    console.error('\nAn error occurred:', err);
});
```

## Advanced Streaming: Observing Skills

The stream doesn't just give you the final text output; it also provides visibility into the agent's "thought process". You can listen for events related to skill execution.

- `TLLMEvent.ToolCall`: Fires when the agent decides to use a skill. The event payload includes the name of the skill and the arguments it's using.
- `TLLMEvent.ToolResult`: Fires after the skill's `process` function has completed. The payload contains the result that was returned by the skill.

This is incredibly useful for debugging or showing the user that the agent is performing an action in the background.

```typescript
// Assuming the 'getWeather' skill from the previous guide is added to the agent...
import { Agent, TLLMEvent } from '@smythos/sdk';

const stream = await agent.prompt('What is the weather in London?').stream();

stream.on(TLLMEvent.ToolCall, ({ name, args }) => {
    console.log(`\n[Agent is using the '${name}' skill with args: ${JSON.stringify(args)}]`);
});

stream.on(TLLMEvent.ToolResult, ({ result }) => {
    console.log(`\n[Skill returned: ${JSON.stringify(result)}]`);
});

stream.on(TLLMEvent.Content, (chunk) => process.stdout.write(chunk));
stream.on(TLLMEvent.End, () => console.log('\n\n--- Done ---'));
```

When you run this, you will see the `ToolCall` and `ToolResult` messages appear in your console before the final natural language response is streamed.

## Next Steps

With streaming, you can build highly responsive and transparent agentic applications. Now, let's explore how to maintain context over multiple interactions by using [Conversations](04-chat.md).
