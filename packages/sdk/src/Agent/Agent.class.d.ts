import { TLLMConnectorParams } from '@smythos/sre';
import EventEmitter from 'events';
import { Chat } from '../LLM/Chat.class';
import { TSkillSettings } from '../Components/Skill';
import { TStorageProviderInstances } from '../types/generated/Storage.types';
import { SDKObject } from '../Core/SDKObject.class';
import { Team } from '../Security/Team.class';
import { TVectorDBProviderInstances } from '../types/generated/VectorDB.types';
import { TLLMProviderInstances } from '../LLM/LLM.class';
import { AgentData, ChatOptions } from '../types/SDKTypes';
import { MCPTransport } from '../MCP/MCP.class';
/**
 * Represents a command that can be executed by an agent.
 *
 * The command can be executed in two ways:
 * - **Promise mode**: returns the final result as a string
 * - **Streaming mode**: returns an event emitter for real-time updates
 *
 * @example
 * ```typescript
 * // Promise mode: get the final result
 * const result = await agent.prompt("Analyze this data").run();
 *
 * // Promise-like usage (automatic execution)
 * const result = await agent.prompt("What's the weather?");
 *
 * // Streaming mode: get real-time updates
 * const stream = await agent.prompt("Write a story").stream();
 * stream.on('data', chunk => console.log(chunk));
 * ```
 */
declare class AgentCommand {
    private prompt;
    private agent;
    private _options?;
    constructor(prompt: string, agent: Agent, _options?: any);
    /**
     * Execute the command and return the result as a promise.
     * This method enables promise-like behavior for the command.
     *
     * @param resolve - Function called when the command completes successfully
     * @param reject - Function called when the command encounters an error
     * @returns Promise that resolves to the agent's response
     */
    then(resolve: (value: string) => void, reject?: (reason: any) => void): Promise<void>;
    private getFiles;
    /**
     * Execute the agent command and return the complete response.
     *
     * @returns Promise that resolves to the agent's response as a string
     *
     * @example
     * ```typescript
     * const response = await agent.prompt("Hello, world!").run();
     * console.log(response);
     * ```
     */
    run(): Promise<string>;
    /**
     * Execute the agent command as a streaming response.
     *
     * **Available Events:**
     * - `'data'` - Text chunk received from the agent
     * - `'end'` - The agent has finished responding
     * - `'error'` - The agent encountered an error
     *
     * @returns Promise that resolves to an EventEmitter for streaming updates
     *
     * @example
     * ```typescript
     * const stream = await agent.prompt("Tell me a long story").stream();
     * stream.on('data', (chunk) => process.stdout.write(chunk));
     * stream.on('end', () => console.log('\nStory completed!'));
     * stream.on('error', (err) => console.error('Error:', err));
     * ```
     */
    stream(): Promise<EventEmitter>;
}
/**
 * Configuration settings for creating an Agent instance.
 *
 * @example
 * ```typescript
 * const settings: TAgentSettings = {
 *   name: "Customer Support Agent",
 *   model: "gpt-4",
 *   behavior: "You are a helpful customer support representative."
 * };
 * ```
 */
export type TAgentSettings = {
    /** The display name for the agent */
    name: string;
    /** The default model to use for agent responses */
    model: string | TLLMConnectorParams;
    /** Optional behavior description that guides the agent's responses */
    behavior?: string;
    [key: string]: any;
};
/**
 * The core Agent class for creating and managing AI agents.
 *
 * An Agent combines models, skills, and behaviors to create intelligent assistants
 * that can process prompts, maintain conversations, and execute tasks.
 *
 * @example
 * ```typescript
 * // Create a simple agent
 * const agent = new Agent({
 *   name: "Assistant",
 *   model: "gpt-4",
 *   behavior: "You are a helpful assistant."
 * });
 *
 * // Use the agent
 * const response = await agent.prompt("Hello, how can you help me?");
 * console.log(response);
 *
 * // Add skills to the agent
 * agent.addSkill({
 *   name: "calculator",
 *   description: "Perform mathematical calculations",
 *   process: (a, b) => a + b
 * });
 * ```
 */
export declare class Agent extends SDKObject {
    private _settings;
    private _hasExplicitId;
    private _warningDisplayed;
    private _data;
    /**
     * The agent internal structure
     * used for by internal operations to generate the agent data
     */
    structure: {
        components: any[];
        connections: any[];
    };
    private _team;
    get team(): Team;
    /**
     * The agent data : this is the equivalent of the .smyth file content.
     *
     * Used for by external operations to get the agent data
     */
    get data(): AgentData;
    /**
     * Create a new Agent instance.
     *
     * @param _settings - Configuration object for the agent
     *
     * @example
     * ```typescript
     * const agent = new Agent({
     *   name: "Data Analyst",
     *   model: "gpt-4",
     *   behavior: "You are an expert data analyst who provides insights."
     * });
     * ```
     */
    constructor(_settings: TAgentSettings);
    private _validateId;
    private _normalizeId;
    /**
     * Import an agent from a file or configuration object.
     *
     * **Supported import patterns:**
     * - Import from `.smyth` file: `Agent.import('/path/to/agent.smyth')`
     * - Import from configuration: `Agent.import(settingsObject)`
     * - Import with overrides: `Agent.import('/path/to/agent.smyth', overrides)`
     *
     * @param data - File path or agent settings object
     * @param overrides - Optional settings to override imported configuration
     * @returns New Agent instance
     *
     * @example
     * ```typescript
     * // Import from file
     * const agent1 = Agent.import('./my-agent.smyth');
     *
     * // Import from configuration object
     * const agent2 = Agent.import({
     *   name: "Imported Agent",
     *   model: "gpt-4"
     * });
     *
     * // Import with overrides
     * const agent3 = Agent.import('./base-agent.smyth', {
     *   name: "Customized Agent",
     *   behavior: "Custom behavior override"
     * });
     * ```
     */
    static import(data: TAgentSettings): Agent;
    static import(data: string, overrides?: any): Agent;
    private _llmProviders;
    /**
     * Access to LLM instances for direct model interactions.
     *
     * **Supported providers and calling patterns:**
     * - `agent.llm.openai(modelId, params)` - OpenAI models
     * - `agent.llm.anthropic(modelId, params)` - Anthropic models
     *
     * @example
     * ```typescript
     * // Direct model access
     * const gpt4 = agent.llm.openai('gpt-4', { temperature: 0.7 });
     * const response = await gpt4.prompt("Explain quantum computing");
     *
     * // Using configuration object
     * const claude = agent.llm.anthropic({
     *   model: 'claude-3-sonnet',
     *   maxTokens: 1000
     * });
     *
     * // Streaming response
     * const stream = await claude.prompt("Write a poem").stream();
     * stream.on('data', chunk => console.log(chunk));
     * ```
     */
    get llm(): TLLMProviderInstances;
    /**
     * Access to storage instances from the agent for direct storage interactions.
     *
     * When using storage from the agent, the agent id will be used as data owner
     *
     * **Supported providers and calling patterns:**
     * - `agent.storage.LocalStorage()` - Local storage
     * - `agent.storage.S3()` - S3 storage
     *
     * @example
     * ```typescript
     * // Direct storage access
     * const local = agent.storage.LocalStorage();
     * const s3 = agent.storage.S3();
     * ```
     */
    private _storageProviders;
    get storage(): TStorageProviderInstances;
    /**
     * Access to vectorDB instances from the agent for direct vectorDB interactions.
     *
     * When using vectorDB from the agent, the agent id will be used as data owner
     *
     * **Supported providers and calling patterns:**
     * - `agent.vectorDB.RAMVec()` - A local RAM vectorDB
     * - `agent.vectorDB.Pinecone()` - Pinecone vectorDB
     */
    private _vectorDBProviders;
    get vectorDB(): TVectorDBProviderInstances;
    /**
     * Add a skill to the agent, enabling it to perform specific tasks or operations.
     *
     * Skills extend the agent's capabilities by providing custom functions that can be
     * called during conversations or prompt processing.
     *
     * A skill can be implemented in two ways:
     * 1. With a process function that defines the skill's core logic
     * 2. As a workflow entry point that can be connected to other components to build complex logic
     *
     *
     * @example
     * ```typescript
     *
     * // Add a data fetching skill
     * agent.addSkill({
     *   name: "fetch_weather",
     *   description: "Get current weather for a location",
     *   process: async (location) => {
     *     const response = await fetch(`/api/weather?location=${location}`);
     *     return response.json();
     *   }
     * });
     *
     * // Add a skill that will be used as an entry point in a workflow
     * agent.addSkill({
     *   name: "fetch_weather",
     *   description: "Get current weather for a location",
     * });
     *
     * // Attach the skill to a workflow
     * ```
     */
    addSkill(settings?: TSkillSettings): {
        out: {
            [key: string]: any;
            headers: any;
            body: any;
            query: any;
        };
        in: (inputs: import("../Components/Skill").TSkillInputs) => void;
    };
    call(skillName: string, ...args: (Record<string, any> | any)[]): Promise<any>;
    /**
     * Send a prompt to the agent and get a response.
     *
     * The returned command can be executed in multiple ways:
     * - **Promise mode**: `await agent.prompt("question")` - returns final result
     * - **Explicit execution**: `await agent.prompt("question").run()` - same as above
     * - **Streaming mode**: `await agent.prompt("question").stream()` - returns event emitter
     *
     * @param prompt - The message or question to send to the agent
     * @returns AgentCommand that can be executed or streamed
     *
     * @example
     * ```typescript
     * // Simple prompt (promise mode)
     * const answer = await agent.prompt("What is the capital of France?");
     *
     *
     * // Streaming for long responses
     * const stream = await agent.prompt("Write a detailed report").stream();
     * stream.on('data', chunk => console.log(chunk));
     * stream.on('end', () => console.log('Complete!'));
     * ```
     */
    prompt(prompt: string, options?: any): AgentCommand;
    /**
     * Create a new chat session with the agent.
     *
     * Chat sessions maintain conversation context and allow for back-and-forth
     * interactions with the agent, preserving message history.
     *
     * @param options - The options for the chat session if you provide a string it'll be used as the chat ID and persistence will be enabled by default
     * @param options.id - The ID of the chat session
     * @param options.persist - Whether to persist the chat session
     * @param options.candidate - The candidate for the chat session
     *
     * @returns Chat instance for interactive conversations
     *
     * @example
     * ```typescript
     * const chat = agent.chat();
     *
     * // Send messages in sequence
     * await chat.send("Hello, I need help with my project");
     * await chat.send("Can you explain the benefits?");
     * await chat.send("What are the next steps?");
     *
     * // Get conversation history
     * const history = chat.getHistory();
     * ```
     */
    chat(options?: ChatOptions | string): Chat;
    /**
     * Expose the agent as a MCP (Model Context Protocol) server
     *
     * The MCP server can be started in two ways:
     * - STDIO: The MCP server will be started in STDIO mode
     * - SSE: The MCP server will be started in SSE mode, this is case the listening url will be **http://localhost:<port>/mcp**
     *
     *
     *
     * @example
     * ```typescript
     * const agent = new Agent({ /* ... agent settings ... *\/ });
     *
     * const stdioMcp = agent.mcp(MCPTransport.STDIO);
     * const sseMcp = agent.mcp(MCPTransport.SSE, 3389);
     *
     *
     * ```
     *
     * @param transport - The transport for the MCP server
     * @param port - The port for the MCP server (when using SSE transport)
     * @returns MCP instance
     */
    mcp(transport: MCPTransport, port?: number): Promise<string>;
    /**
     * Export the agent workflow as a plain object
     */
    export(): any;
}
export {};
