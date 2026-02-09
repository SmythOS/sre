# Maintaining Conversations with Chat

While `agent.prompt()` is great for single, one-off questions, most interesting applications require a continuous dialogue where the agent remembers previous interactions. The SmythOS SDK handles this through the `agent.chat()` method.

The `agent.chat()` method creates a `Chat` instance, which automatically manages the history of messages between the user and the agent, providing the necessary context for follow-up questions.

The [`03-chat.ts`](https://github.com/SmythOS/sre/blob/main/examples/01-agent-code-skill/03-chat.ts) script demonstrates a simple in-memory conversation.

## In-Memory Chat

By default, `agent.chat()` creates a temporary, in-memory conversation. The history is maintained for the lifetime of the `chat` object.

```typescript
import { Agent } from '@smythos/sdk';

const agent = new Agent({
    name: 'Helpful Assistant',
    model: 'gpt-4o',
});

// Start a new conversation
const chat = agent.chat();

console.log('User: Hi, my name is Alex.');
// The agent will process this and store it in the conversation history.
const response1 = await chat.prompt('Hi, my name is Alex.');
console.log('Agent:', response1);

console.log('\nUser: What is my name?');
// Because the chat object maintains history, the agent can answer this question.
const response2 = await chat.prompt('What is my name?');
console.log('Agent:', response2); // "Your name is Alex."

// A new chat instance would have no memory of the name.
const newChat = agent.chat();
const forgottenResponse = await newChat.prompt('What is my name?');
console.log('\nAgent (new chat):', forgottenResponse); // "I'm sorry, I don't know your name."
```

## Persistent Chat

For many applications, like a web server or a command-line tool, you need conversations to persist across different sessions. You can achieve this by providing an `id` and setting `persist: true` in the chat options. This tells the SDK to save the conversation history using the configured Storage provider.

The [`04-chat-interactive-persistent.ts`](https://github.com/SmythOS/sre/blob/main/examples/01-agent-code-skill/04-chat-interactive-persistent.ts) script shows this in action with an interactive loop.

Here's a simplified example of how it works:

```typescript
// Assume 'agent' is already created.

const CHAT_ID = 'user-123-support-session';

// --- First run ---
console.log('--- Simulating first interaction ---');
// The first time we use this ID, a new chat history is created and persisted.
const chat1 = agent.chat({ id: CHAT_ID, persist: true });
const initialResponse = await chat1.prompt('Hello, I need help with my account.');
console.log('Agent:', initialResponse);
console.log('--------------------------------\n');

// --- Later, in a separate process or run ---
console.log('--- Simulating a follow-up interaction ---');
// By using the same ID, the SDK loads the previous conversation history.
const chat2 = agent.chat({ id: CHAT_ID, persist: true });
const followupResponse = await chat2.prompt('I mentioned my issue earlier, can you check the status?');
console.log('Agent:', followupResponse); // The agent will have context about the account issue.
console.log('--------------------------------');
```

When `persist` is enabled, every `chat.prompt()` call will automatically save the new user message and the agent's response to storage, ensuring a seamless conversational experience for your users across multiple interactions.

## Next Steps

You've learned how to create stateful, conversational agents. Now let's look at how you can define and manage your agents declaratively using [smyth Files](05-smyth-files.md).
