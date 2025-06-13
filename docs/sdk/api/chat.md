# Chat

`Chat` provides conversation management with optional persistence. Instances are usually created from an agent via `agent.chat()` but can also be started from an `LLMInstance`.

```typescript
const chat = agent.chat();
await chat.prompt('Hello');
```

Enable persistence by providing an id and `persist: true`:

```typescript
const chat = agent.chat({ id: 'session-1', persist: true });
```

`chat.prompt()` returns a command supporting `.run()` or `.stream()` just like agent prompts.

```typescript
const stream = await chat.prompt('Tell me a joke').stream();
```
