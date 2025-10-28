Welcome to the SmythOS SDK! This powerful toolkit allows you to build, manage, and deploy sophisticated AI agents with ease. Whether you're creating a simple chatbot or a complex multi-agent system, the SmythOS SDK provides the tools you need to bring your ideas to life.

The SDK is a lightweight wrapper around the Smyth Runtime Environment. It lets you create and run agents with minimal setup while still allowing advanced customisation when needed.

## Key Features

-   **Fluent Agent API**: A clean and intuitive API for creating and interacting with agents.
-   **Extensible Skills**: Easily add new capabilities to your agents, from calling APIs to running custom code.
-   **Streaming Support**: Get real-time responses from your agents for dynamic and interactive experiences.
-   **Integrated AI Components**: Seamlessly connect to LLMs, Vector Databases, and Storage solutions.
-   **Agent Serialization**: Save and load your agent's state, including skills and memory.
-   **Team Management**: Orchestrate multiple agents to work together in teams.
-   **Document Parsing**: Built-in support for parsing various document types like PDF, DOCX, and Markdown.
-   **Full SRE Access**: Access the complete Smyth Runtime Environment API through `@smythos/sdk/core` for advanced use cases.

## Import Paths

The SDK provides two import paths:

### Main SDK (`@smythos/sdk`)

The simplified, developer-friendly API for common use cases:

```typescript
import { Agent, LLM, VectorDB, Storage } from '@smythos/sdk';
```

### Core SRE (`@smythos/sdk/core`)

Full access to the complete Smyth Runtime Environment for advanced scenarios:

```typescript
import { SmythRuntime, SecureConnector, ACL, TAccessLevel } from '@smythos/sdk/core';
```

This allows you to use a single package while having access to both the simplified SDK API and the full SRE capabilities when needed.

## Getting Started

Let's build your first agent in just a few lines of code. This example creates a simple agent that can fetch cryptocurrency prices.

### 1. Install SmythOS CLI

The easiest way to get started is by using the scaffolding command from the SmythOS CLI.

**Install the cli using your preferred package manager**

```bash
# install the cli using your preferred package manager
npm i -g @smythos/cli
```

this will install "sre" command in your system.

**Create a new project**

Run the following command, and follow the instructions to create a new project.

```bash
sre create "My Awesome Agent"
```

Select **Empty Project** template when asked.

### 2. Create your First Agent

Edit `index.ts` file and add the following code:

```typescript
import { Agent } from '@smythos/sdk';

async function main() {
    // Create a new agent
    const agent = new Agent({
        name: 'Book Assistant',
        model: 'gpt-4o',
        behavior: 'You are a helpful assistant that can answer questions about the books.',
    });

    // Add a skill to the agent that uses the openlibrary api to get information about a book
    agent.addSkill({
        name: 'get_book_info',
        description: 'Use this skill to get information about a book',
        process: async ({ book_name }) => {
            const url = `https://openlibrary.org/search.json?q=${book_name}`;

            const response = await fetch(url);
            const data = await response.json();

            return data.docs[0];
        },
    });

    // Prompt the agent and let it use the skill
    const promptResult = await agent.prompt('What is the author of the book "The Great Gatsby" ?');

    //get the result
    console.log(promptResult);
}

main();
```

### 3. Run your Agent

first you need to build the project

```bash
npm run build
```

then you can run the agent

```bash
npm start
```

You should see your agent respond with the author of the book "The Great Gatsby"!

### Reporting Issues

If you face any issues with the CLI or the code, set environment variable LOG_LEVEL="debug" and run your code again. Then share the logs with us, it will help diagnose the problem.
You can request help on our [Discord](https://discord.gg/smythos) or by creating an issue on [GitHub](https://github.com/SmythOS/smythos/issues)

## Core Concepts

### Agents

The `Agent` is the fundamental building block of the SmythOS SDK. It encapsulates a model, a set of behaviors, and a collection of skills. You can interact with an agent by sending it prompts.

```typescript
import { Agent } from '@smythos/sdk';

const agent = new Agent({
    name: 'Book Assistant',
    model: 'gpt-4o',
    behavior: 'You are a helpful assistant that can answer questions about the books.',
});
```

### Prompting

The `prompt()` method is the primary way to interact with an agent. It returns a special `AgentCommand` object which can be awaited directly for a simple response, or used to stream the response for real-time applications.

**Promise-based response:**

```typescript
const response = await agent.prompt('What is the author of the book "The Great Gatsby" ?');
console.log(response);
```

**Streaming response:**

```typescript
const stream = await agent.prompt('Tell me a story.').stream();
stream.on(TLLMEvent.Content, (chunk) => process.stdout.write(chunk));

//other events are available
//TLLMEvent.Content  : Generated response chunks
//TLLMEvent.Thinking : Thinking blocks/chunks
//TLLMEvent.End : End of the response
//TLLMEvent.Error : Error
//TLLMEvent.ToolInfo : Tool information : emitted by the LLM determines the next tool call
//TLLMEvent.ToolCall : Tool call : emitted before the tool call
//TLLMEvent.ToolResult : Tool result : emitted after the tool call
//TLLMEvent.Usage : Tokens usage information
//TLLMEvent.Interrupted : Interrupted : emitted when the response is interrupted before completion
```

### Skills

Skills are functions that you can add to your agent to extend its capabilities. The agent's LLM can intelligently decide which skill to use based on the user's prompt.

#### Code skills

A code skill, is a skill where the logic is defined in the skill "process" function.
This is the classic way of implementing skills via SDK

```typescript
agent.addSkill({
    name: 'calculator',
    description: 'Perform mathematical calculations.',
    process: async ({ operation, a, b }) => {
        if (operation === 'add') return a + b;
        if (operation === 'subtract') return a - b;
        // ...
    },
});
```

#### Workflow skills

A workflow skill, is a skill where the logic is defined in a workflow.
This is the internal mode used by the visual designer, but can also be implemented programmatically.
(Will be covered in a separate documentation)

You can also call a skill directly using `agent.call()`:

```typescript
const sum = await agent.call('calculator', { operation: 'add', a: 5, b: 3 });
console.log(sum); // 8
```

## Documentation

Comprehensive guides are available in the `docs/` directory:

1. [Getting Started](./docs/01-getting-started.md) - Installation and your first agent
2. [Building Agents](./docs/02-agents.md) - Agent creation, modes, and skills
3. [Streaming Responses](./docs/03-streaming.md) - Real-time response handling
4. [Chat Conversations](./docs/04-chat.md) - Building conversational agents
5. [Smyth Files](./docs/05-smyth-files.md) - Working with .smyth workflow files
6. [Workflows](./docs/06-workflows.md) - Building complex workflows
7. [Services](./docs/07-services.md) - Using LLM, VectorDB, and Storage services
8. [Vector Databases](./docs/08-vector-db.md) - Vector database integration
9. [Advanced Topics](./docs/08-advanced-topics.md) - Deep dive into advanced features
10. [Language Models](./docs/09-models.md) - Complete guide to model configuration
11. [Cheat Sheet](./docs/99-cheat-sheet.md) - Quick reference guide

## API Reference

For a detailed breakdown of all classes and methods, please refer to our [full API documentation](./docs/01-getting-started.md).

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for more details.
