# Conversations

A chat instance tracks previous messages so the model can refer back to them. Use `agent.chat()` to start a conversation. The full workflow is shown in [`03-chat.ts`](../../examples/01-agent-code-skill/03-chat.ts).

```typescript
const chat = agent.chat();
await chat.prompt('Hi, my name is John Smyth. Give me the current price of Bitcoin?');
await chat.prompt('Do you remember my name?');
```

## Persistence

Chats can persist across process runs when an id is supplied and `persist: true` is set. This is useful for command line tools or web servers. See [`04-chat-interactive-persistent.ts`](../../examples/01-agent-code-skill/04-chat-interactive-persistent.ts) for an interactive example.

```typescript
const chat = agent.chat({ id: 'my-chat-0001', persist: true });
```

Next: [Loading `.smyth` Files](05-smyth-files.md).
