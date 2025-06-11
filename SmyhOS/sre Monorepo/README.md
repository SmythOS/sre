# SmythOS - The Operating System for Agentic AI

> **Next-Generation AI Agent Runtime Platform**

Welcome to **SmythOS**, a comprehensive platform designed to be the operating system for Agentic AI. This monorepo contains the complete SmythOS ecosystem, providing everything you need to build, deploy, and manage intelligent AI agents at scale.

## What is SmythOS?

SmythOS is revolutionizing how we build and deploy AI agents by providing a complete **Operating System for Agentic AI**. Just as traditional operating systems manage resources and provide APIs for applications, SmythOS manages AI resources and provides APIs for intelligent agents.

**Key Benefits:**

-   🤖 **Agent-First Design**: Built specifically for AI agent workloads
-   🔒 **Enterprise Security**: Built-in access control, data isolation, and secure credential management
-   ⚡ **Production-Ready**: Scalable, observable, and battle-tested
-   🧩 **Modular Architecture**: Extensible connector system for any infrastructure
-   🎨 **Developer-Friendly**: Simple SDK that scales from development to production

## Repository Structure

This monorepo contains three main packages:

### SRE (Smyth Runtime Environment) - `packages/core`

The **SRE** is the core runtime environment that powers SmythOS. Think of it as the kernel of the AI agent operating system.

**Features:**

-   **🔌 Modular Architecture**: Pluggable connectors for every service (Storage, LLM, VectorDB, Cache, etc.)
-   **🛡️ Security-First**: Built-in Candidate/ACL system for secure resource access
-   **📊 Resource Management**: Intelligent memory, storage, and compute management
-   **🔄 Agent Orchestration**: Complete agent lifecycle management
-   **🧩 40+ Components**: Production-ready components for AI, data processing, and integrations

**Supported Connectors:**

-   **Storage**: Local, S3, Google Cloud, Azure
-   **LLM**: OpenAI, Anthropic, Google AI, AWS Bedrock, Groq, Perplexity
-   **VectorDB**: Pinecone, Chroma, SmythManaged
-   **Cache**: RAM, Redis, Memcached
-   **Vault**: HashiCorp Vault, AWS Secrets Manager, JSON File

### 🎨 SDK - `packages/sdk`

The **SDK** provides a clean, developer-friendly abstraction layer over the SRE runtime. It's designed for simplicity without sacrificing power.

**Why Use the SDK:**

-   ✅ **Simple API**: Clean, intuitive interface that's easy to learn
-   🔧 **Type-Safe**: Full TypeScript support with IntelliSense
-   🚀 **Production-Ready**: Same code works in development and production
-   📈 **Configuration-Independent**: Business logic stays unchanged as infrastructure scales

### 🛠️ CLI - `packages/cli`

The **SRE CLI** helps you get started quickly with scaffolding and project management.

## 🚀 Quick Start

### Method 1: Using the CLI (Recommended)

Install the CLI globally and create a new project:

```bash
npm i -g @smythos/cli
sre create
```

The CLI will guide you step-by-step to create your SDK project with the perfect configuration for your needs.

### Method 2: Direct SDK Installation

Add the SDK directly to your existing project:

```bash
npm install @smythos/sdk
```

## 💡 Quick code examples

The SDK allows you to build agents with code or load and run a .smyth file.
.smyth is the extension of agents built with our SmythOS builder.

## Example 1 : load and run an agent from .smyth file

```typescript
async function main() {
    const agentPath = path.resolve(__dirname, 'my-agent.smyth');

    //Importing the agent workflow
    const agent = Agent.import(agentPath, {
        model: Model.OpenAI('gpt-4o'),
    });

    //query the agent and get the full response
    const result = await agent.prompt('Hello, how are you ?');

    console.log(result);
}
```

Want stream mode ? easy

```typescript
    const events = await agent.prompt('Hello, how are you ?').stream();
    events.on('content', (text) => {
        console.log('content');
    });

    events.on('end', /*... handle end ... */)
    events.on('usage', /*... collect agent usage data ... */)
    events.on('toolCall', /*... ... */)
    events.on('toolResult', /*... ... */)
    ...

```

Want chat mode ? easy

```typescript
    const chat = agent.chat();

    //from there you can use the prompt or prompt.stream to handle it

    let result = await chat.prompt("Hello, I'm Smyth")
    console.log(result);

    result = await chat.prompt('Do you remember my name ?");
    console.log(result);


    //the difference between agent.prompt() and chat.prompt() is that the later remembers the conversation
```

## Example 2 : Article Writer Agent

Here's a complete example showing how to create an agent that uses LLM, VectorDB, and Storage:

```typescript
import { Agent, Model } from '@smythos/sdk';

async function main() {
    // Create an intelligent agent
    const agent = new Agent({
        name: 'Article Writer',
        model: 'gpt-4o',
        behavior: 'You are a copy writing assistant. The user will provide a topic and you have to write an article about it and store it.',
    });

    // Add a custom skill that combines multiple AI capabilities
    agent.addSkill({
        id: 'AgentWriter_001',
        name: 'WriteAndStoreArticle',
        description: 'Writes an article about a given topic and stores it',
        process: async ({ topic }) => {
            // 🔍 VectorDB - Search for relevant context
            const vec = agent.vectordb.Pinecone({
                namespace: 'myNameSpace',
                indexName: 'demo-vec',
                pineconeApiKey: process.env.PINECONE_API_KEY,
                embeddings: Model.OpenAI('text-embedding-3-large'),
            });

            const searchResult = await vec.search(topic, {
                topK: 10,
                includeMetadata: true,
            });
            const context = searchResult.map((e) => e?.metadata?.text).join('\n');

            // 🧠 LLM - Generate the article
            const llm = agent.llm.OpenAI('gpt-4o-mini');
            const result = await llm.prompt(`Write an article about ${topic} using the following context: ${context}`);

            // 💾 Storage - Save the article
            const storage = agent.storage.S3();
            const uri = await storage.write('article.txt', result);

            return `The article has been generated and stored. Internal URI: ${uri}`;
        },
    });

    // Use the agent
    const result = await agent.prompt('Write an article about Sakura trees');
    console.log(result);
}

main().catch(console.error);
```

## 🏗️ Architecture Highlights

### 🔒 Security-First Design

Every operation requires proper authorization through the Candidate/ACL system:

```typescript
const candidate = AccessCandidate.agent(agentId);
const storage = ConnectorService.getStorageConnector().user(candidate);
await storage.write('data.json', content);
```

### 🔄 Development to Production Evolution

Your business logic stays identical while infrastructure scales:

```typescript
// When you use the SDK, SmythOS will be implicitly initialized with general connectors that covers standard agent use cases.

// you don't need to explicitly initialize SRE
// we are just showing you how it is initialized internally
// const sre = SRE.init({
//     Cache: { Connector: 'RAM' },
//     Storage: { Connector: 'Local' },
//     Log: { Connector: 'ConsoleLog' },
// });

async function main() {
    // your agent logic goes here
}

main();


// But you can explicitly initialize SRE with other built-in connectors, or make your own
// Use cases :
//  - You want to use a custom agents store
//  - You want to store your API keys and other credentials in a more secure vault
//  - You need enterprise grade security and data isolation
//  - ...
const sre = SRE.init({
    Account: { Connector: 'EnterpriseAccountConnector', Settings: { ... } },
    Vault: { Connector: 'Hashicorp', Settings: { url: 'https://vault.company.com' } },
    Cache: { Connector: 'Redis', Settings: { url: 'redis://prod-cluster' } },
    Storage: { Connector: 'S3', Settings: { bucket: 'company-ai-agents' } },
    VectorDB: { Connector: 'Pinecone', Settings: { indexName: 'company-ai-agents' } },
    Log: { Connector: 'CustomLogStore'},
});


async function main() {
    // your agent logic goes here
}

main();

```

### 🧩 Component System

40+ production-ready components for every AI use case:

-   **🤖 AI/LLM**: `GenAILLM`, `VisionLLM`, `MultimodalLLM`, `LLMAssistant`
-   **🌐 External**: `APICall`, `WebSearch`, `WebScrape`, `ZapierAction`
-   **📊 Data**: `DataSourceIndexer`, `DataSourceLookup`, `JSONFilter`
-   **🔧 Logic**: `LogicAND`, `LogicOR`, `Classifier`, `ForEach`
-   **💾 Storage**: `FileStore`, `Code`, `ServerlessCode`

## 🌟 Key Features

| Feature                  | Description                                            |
| ------------------------ | ------------------------------------------------------ |
| **🎯 Agent-Centric**     | Built specifically for AI agent workloads and patterns |
| **🔒 Secure by Default** | Enterprise-grade security with data isolation          |
| **⚡ High Performance**  | Optimized for high-throughput AI operations            |
| **🧩 Modular**           | Swap any component without breaking your system        |
| **📊 Observable**        | Built-in monitoring, logging, and debugging tools      |
| **🌍 Cloud-Native**      | Runs anywhere - local, cloud, edge, or hybrid          |
| **🔄 Scalable**          | From development to enterprise production              |

## 📚 Documentation

-   **[Complete Overview](packages/core/doc/overview.md)** - Deep dive into SRE architecture
-   **[SDK Documentation](packages/sdk/README.md)** - SDK API reference and examples
-   **[Component Library](packages/core/doc/components/)** - All available components

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 🔮 What's Next?

Join our [community](https://discord.gg/smythos) to stay updated on new features, connectors, and capabilities.

---

**Ready to build the next generation of AI agents?** Start with SmythOS and focus on what matters - the intelligence, not the infrastructure.
