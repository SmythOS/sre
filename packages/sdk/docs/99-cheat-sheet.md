# Agent capabilities

## Create Agent

```typescript
import { Agent } from '@smythos/sdk';

const agent = new Agent({
    name: 'Book Assistant',
    model: 'gpt-4o',
    behavior: 'You are a helpful assistant that can answer questions about the books.',
});
```

## Add Code Skill

```typescript
agent.addSkill({
    name: 'get_book_info',
    description: 'Use this skill to get information about a book',
    process: async ({ book_name }) => {
        /* ... Skill logic ... */
    },
});
```

## Call a skill directly

```typescript
const result = await agent.call('get_book_info', { book_name: 'The Great Gatsby' });
console.log(result);
```

## Prompt Agent

```typescript
const response = await agent.prompt('Who is the author of "The Great Gatsby"?');
console.log(response);
```

## Prompt Agent with attachment

```typescript
const response = await agent.prompt('Who is the author of "The Great Gatsby"?', {
    files: ['./path/to/image.png', 'https://image.com/myimage.png'],
});
console.log(response);
```

## Handle attachment with agent skill

```typescript
//First we define the skill that will handle the image
const imgSkill = agent.addSkill({
    name: 'ImageAnalyser',
    description: 'Any attachment should be processed by this function',
    process: async ({ image_url }) => {
        /* ... image processing goes here ...*/
        return 'Image analysed';
    },
});
//very important, we need to force the input type of image_url to Binary
//this will tell our agent to skip the native LLM image processing, and use the agent skill instead
imgSkill.in({
    image_url: {
        type: 'Binary',
        description: 'The image url that we will analyze',
    },
});

//now the images will be processed by the agent skill instead of the native LLM
const response = await agent.prompt('Who is the author of "The Great Gatsby"?', {
    files: ['./path/to/image.png', 'https://image.com/myimage.png'],
});
```

## Prompt Agent with Stream

```typescript
const stream = await agent.prompt('Who is the author of "The Great Gatsby"?').stream();

stream.on(TLLMEvent.Content, (data) => {
    console.log(data);
});
//all available events: Content, End, Error, Thinking, ToolInfo, ToolCall, ToolResult, Usage
```

## Chat with Agent

```typescript
//Simple chat with a session id
const chat = agent.chat('my-chat-session');

//Persisted chat
const persistedChat = agent.chat({ id: 'my-chat-session', persist: true });

//with prompt
const response = await chat.prompt('Hi there');
console.log(response);

//with stream
const stream = await chat.prompt('Hi there').stream();

stream.on(TLLMEvent.Content, (data) => {
    console.log(data);
});
```

## Run agent as MCP

```typescript
//with stdio transport
await agent.mcp(MCPTransport.STDIO);

//with SSE transport, you can define the port number in the second argument
const mcpUrl = await agent.mcp(MCPTransport.SSE, 3388);
```

## LLMs

### Query llm through agent

```typescript
const llm = agent.llm.OpenRouter('gpt-4o');
//other available models : agent.llm.Anthropic(...), agent.llm.Google(...), agent.llm.Groq(...), agent.llm.TogetherAI(...), agent.llm.Bedrock(...), agent.llm.VertexAI(...), agent.llm.xAI(...), agent.llm.Perplexity(...)

//prompt
const response = await llm.prompt('Who is the author of "The Great Gatsby"?');
console.log(response);

//stream
const stream = await llm.prompt('Who is the author of "The Great Gatsby"?').stream();

stream.on(TLLMEvent.Content, (data) => {
    console.log(data);
});
```

### Query LLM with advanced settings

```typescript
const llm = agent.llm.OpenRouter('gpt-4o', {
    temperature: 0.5,
    max_tokens: 100,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
});
```

### Query LLM with custom api key

```typescript
const llm = agent.llm.OpenRouter('gpt-4o', {
    apiKey: 'your-api-key',
});
```

### Query LLM with custom model

```typescript
const llm = agent.llm.OpenRouter(Model.OpenRouter('custom-model', { baseURL: 'https://api.custom-model.com' }));
```

## Local Storage

### Local Storage

```typescript
const storage = agent.storage.LocalStorage();
await storage.write('test.txt', 'Hello, world!');
const data = await storage.read('test.txt');
console.log(data);
```

### S3 Storage

```typescript
const storage = agent.storage.S3Storage({
    bucket: 'your-bucket',
    region: 'your-region',
});
```

## VectorDB

### Pinecone

```typescript
const pinecone = agent.vectorDB.Pinecone('my-namespace', {
    indexName: 'my-index',
    apiKey: 'your-pinecone-api-key',
    embeddings: Model.OpenRouter('text-embedding-3-large'),
});

await pinecone.insertDoc('my-doc', 'This is the content of my document');
const results = await pinecone.search('my query');
```

### Milvus

```typescript
const milvus = agent.vectorDB.Milvus('my-collection', {
    credentials: {
        address: 'your-milvus-address',
        token: 'your-milvus-token',
    },
    embeddings: Model.OpenRouter('text-embedding-3-large'),
});

await milvus.insertDoc('my-doc', 'This is the content of my document');
const results = await milvus.search('my query');
```

### RAMVec (In-Memory)

```typescript
// RAMVec is a zero-config, in-memory vector DB for quick testing.
const ramvec = agent.vectorDB.RAMVec('my-collection');

await ramvec.insertDoc('my-doc', 'This is the content of my document');
const results = await ramvec.search('my query');
```

# Standalone

Many capabilities are also available as standalone classes, you can use them without an agent

## LLMs

### Access LLM models

```typescript
const llmOpenRouterGPT4Mini = LLM.OpenRouter('gpt-4o-mini');
const anthropicClaude4Sonnet = LLM.Anthropic('claude-4.0-sonnet');
const googleGemini20Flash = LLM.Google('gemini-2.0-flash');
//...
```

### Prompt LLM

```typescript
const result = await llmOpenRouterGPT4Mini.prompt('Hello, how are you?');
```

### Prompt LLM with attachment

```typescript
const llm = LLM.OpenRouter('gpt-4o-mini');

const result = await llm.prompt('Describe these images?', {
    files: ['./path/to/image.png', 'https://image.com/myimage.png'],
});
```

### Prompt LLM with stream

```typescript
const stream = await llmOpenRouterGPT4Mini.prompt('Hello, how are you?').stream();

stream.on(TLLMEvent.Content, (data) => {
    console.log(data);
});
```

## Storage

### Local Storage

```typescript
const storage = Storage.LocalStorage();
await storage.write('test.txt', 'Hello, world!');
const data = await storage.read('test.txt');
console.log(data);
```

### S3 Storage

```typescript
const storage = Storage.S3Storage({
    bucket: 'your-bucket',
    region: 'your-region',
});
await storage.write('test.txt', 'Hello, world!');
const data = await storage.read('test.txt');
console.log(data);
```

## VectorDB

### Pinecone

```typescript
const pinecone = VectorDB.Pinecone('my-namespace', {
    indexName: 'my-index',
    apiKey: 'your-pinecone-api-key',
    embeddings: Model.OpenRouter('text-embedding-3-large'),
});

await pinecone.insertDoc('my-doc', 'This is the content of my document');
const results = await pinecone.search('my query');
```

### Milvus

```typescript
const milvus = VectorDB.Milvus('my-collection', {
    credentials: {
        address: 'your-milvus-address',
        token: 'your-milvus-token',
    },
    embeddings: Model.OpenRouter('text-embedding-3-large'),
});

await milvus.insertDoc('my-doc', 'This is the content of my document');
const results = await milvus.search('my query');
```

### RAMVec (In-Memory)

```typescript
// RAMVec is a zero-config, in-memory vector DB for quick testing.
const ramvec = VectorDB.RAMVec('my-collection');

await ramvec.insertDoc('my-doc', 'This is the content of my document');
const results = await ramvec.search('my query');
```

## Doc Parsers

### Auto-detect parser from file

```typescript
const parsedDoc = await Doc.auto.parse('./path/to/file.pdf');
```

### Explicitly select a parser

```typescript
//PDF
const parsedPDFDoc = await Doc.pdf.parse('./path/to/file.pdf');

//DOCX
const parsedDocxDoc = await Doc.docx.parse('./path/to/file.docx');

//Markdown
const parsedMarkdownDoc = await Doc.md.parse('./path/to/file.md');

//Text
const parsedTxtDoc = await Doc.text.parse('./path/to/file.txt');
```

### Parse from a string

```typescript
const parsedString = await Doc.text.parse('This is the content of my document');
```

### Add custom metadata

```typescript
const parsedDoc = await Doc.auto.parse('./path/to/file.pdf', {
    title: 'My Document',
    author: 'John Doe',
});
```
