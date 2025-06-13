# LLMInstance

Instances created by `LLM` or via `agent.llm` expose a simple interface to query language models.

```typescript
const llm = LLM.OpenAI('gpt-4o-mini');
const text = await llm.prompt('Hello world');
```

### Streaming

```typescript
const stream = await llm.prompt('Tell me a story').stream();
stream.on('content', chunk => process.stdout.write(chunk));
```

### Chat sessions

LLM instances can also start a chat conversation:

```typescript
const chat = llm.chat();
await chat.prompt('Hi');
```
