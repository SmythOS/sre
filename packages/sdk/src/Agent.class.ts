import { AccessCandidate, Conversation, DEFAULT_TEAM_ID, TLLMConnectorParams, TLLMEvent, TLLMProvider } from '@smythos/sre';
import EventEmitter from 'events';
import { Chat } from './Chat.class';
import { Component } from './components/components.index';
import { ComponentWrapper } from './components/ComponentWrapper.class';
import { TSkillSettings } from './components/Skill';
import { DummyAccountHelper } from './DummyAccount.helper';

import { StorageInstance } from './Storage.class';
import { TStorageProvider, TStorageProviderInstances } from './types/generated/Storage.types';
import { uid } from './utils/general.utils';
import { SDKObject } from './SDKObject.class';
import fs from 'fs';
import { SDKLog } from './utils/console.utils';
import { help } from './help';
import { Team } from './Team.class';
import { TVectorDBProvider, TVectorDBProviderInstances } from './types/generated/VectorDB.types';
import { VectorDBInstance } from './VectorDB.class';
import { TLLMInstanceFactory, TLLMProviderInstances } from './LLM/LLM.class';
import { LLMInstance, TLLMInstanceParams } from './LLM/LLMInstance.class';

const console = SDKLog;

export type AgentData = {
    id: string;
    version: string;
    name: string;
    behavior: string;
    components: any[];
    connections: any[];
    defaultModel: string;
    teamId: string;
};

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
class AgentCommand {
    constructor(private prompt: string, private agent: Agent) {}

    /**
     * Execute the command and return the result as a promise.
     * This method enables promise-like behavior for the command.
     *
     * @param resolve - Function called when the command completes successfully
     * @param reject - Function called when the command encounters an error
     * @returns Promise that resolves to the agent's response
     */
    then(resolve: (value: string) => void, reject?: (reason: any) => void) {
        return this.run().then(resolve, reject);
    }

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
    async run(): Promise<string> {
        await this.agent.ready;

        const filteredAgentData = {
            ...this.agent.data,
            components: this.agent.data.components.filter((c) => !c.process),
        };
        const conversation = new Conversation(this.agent.data.defaultModel, filteredAgentData, {
            agentId: this.agent.data.id,
        });

        conversation.on(TLLMEvent.Error, (error) => {
            console.error('An error occurred while running the agent: ', error.message);
        });

        // Register process skills as custom tools
        await this.registerProcessSkills(conversation);

        const result = await conversation.streamPrompt(this.prompt).catch((error) => {
            console.error('Error on streamPrompt: ', error);
            return { error };
        });

        return result;
    }

    private async registerProcessSkills(conversation: Conversation) {
        await this.agent.ready;

        // Find all skills with process functions and register them as tools
        const processSkills: ComponentWrapper[] = this.agent.structure.components.filter((c: ComponentWrapper) => c.internalData.process);

        for (const skill of processSkills) {
            await conversation.addTool({
                name: skill.data.data.endpoint,
                description: skill.data.data.description,
                //arguments: _arguments,
                handler: skill.internalData.process,
            });
        }
    }

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
    async stream(): Promise<EventEmitter> {
        await this.agent.ready;
        const conversation = new Conversation(this.agent.data.defaultModel, this.agent.data, {
            agentId: this.agent.data.id,
        });
        conversation.streamPrompt(this.prompt);

        return conversation;
    }

    // Future extensibility:
    // async batch(): Promise<string[]>
    // temperature(temp: number): PromptBuilder : override the modelParams
    // maxTokens(maxTokens: number): PromptBuilder : override the modelParams
    // ...
    // params(...): PromptBuilder : override the modelParams
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
export class Agent extends SDKObject {
    private _hasExplicitId: boolean = false;
    private _data: AgentData = {
        version: '1.0.0',
        name: '',
        behavior: '',
        defaultModel: '',
        id: '',
        teamId: DEFAULT_TEAM_ID,
        components: [],
        connections: [],
    };
    public structure = {
        components: [],
        connections: [],
    };

    private _team: Team;
    public get team() {
        if (!this._team) {
            this._team = new Team(this._data.teamId);
        }
        return this._team;
    }

    public get data(): AgentData {
        //console.log(this.structure);
        const _dataClone = JSON.parse(JSON.stringify(this._data));

        const data = {
            ..._dataClone,
        };

        for (let c of this.structure.components as ComponentWrapper[]) {
            data.components.push(c.data);
        }

        for (let c of this.structure.connections) {
            data.connections.push(c);
        }

        return data;
    }

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
    constructor(private _settings: TAgentSettings) {
        super();

        const { model, ...rest } = this._settings;
        this._data.defaultModel = model as string;

        for (let key in rest) {
            this._data[key as keyof AgentData] = rest[key];
        }

        //when creating a new agent, we make sure to create new unique id
        if (!this._data.id) {
            console.warn('No id provided for the agent, generating a new one');
            this._data.id = `${this._data.name ? this._data.name + '_' : ''}${uid()}`;
        } else {
            this._hasExplicitId = true;
        }

        //use default team id for the SDK
        if (!this._data.teamId) {
            console.warn('No team id provided for the agent, using default team id');
            this._data.teamId = DEFAULT_TEAM_ID;
        }

        this._data.teamId = this._data.teamId || DEFAULT_TEAM_ID;

        //if we are using DummyAccount, populate the account data in order to inform it about our newly loaded agent
        DummyAccountHelper.addAgentToTeam(this._data.id, this._data.teamId);
    }

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
    static import(data: string | TAgentSettings, overrides?: TAgentSettings) {
        if (typeof data === 'string') {
            if (!fs.existsSync(data)) {
                throw new Error(`File ${data} does not exist`);
            }

            data = JSON.parse(fs.readFileSync(data, 'utf8')) as TAgentSettings;

            //when importing a .smyth file we need to override the id and teamId
            delete data.id;
            delete data.teamId;
        }

        const _data = {
            ...(data as TAgentSettings),
            ...(overrides as TAgentSettings),
        };
        const agent = new Agent(_data);
        return agent;
    }

    private _llmProviders: TLLMProviderInstances;

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
    public get llm() {
        if (!this._llmProviders) {
            this._llmProviders = {} as TLLMProviderInstances;

            for (const provider of Object.keys(TLLMProvider)) {
                this._llmProviders[provider] = ((modelIdOrParams: string | TLLMInstanceParams, modelParams?: TLLMInstanceParams): LLMInstance => {
                    if (typeof modelIdOrParams === 'string') {
                        // First signature: (modelId: string, modelParams?: TLLMInstanceParams)
                        return new LLMInstance(TLLMProvider[provider], {
                            model: modelIdOrParams,
                            ...modelParams,
                        });
                    } else {
                        // Second signature: (modelParams: TLLMInstanceParams)
                        return new LLMInstance(TLLMProvider[provider], modelIdOrParams);
                    }
                }) as TLLMInstanceFactory;
            }
        }
        return this._llmProviders;
    }

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
    private _storageProviders: TStorageProviderInstances;

    public get storage() {
        if (!this._storageProviders) {
            this._storageProviders = {} as TStorageProviderInstances;
            for (const provider of Object.values(TStorageProvider)) {
                this._storageProviders[provider] = (storageSettings?: any) =>
                    new StorageInstance(provider as TStorageProvider, storageSettings, AccessCandidate.agent(this._data.id));
            }
        }
        if (!this._hasExplicitId) {
            console.warn(
                `You are performing storage operations with an unidentified agent.\nAn ID is required if you want to persist data accross multiple sessions.\nLearn more about the storage access model here: ${help.SDK.AGENT_STORAGE_ACCESS}`
            );
        }
        return this._storageProviders;
    }

    /**
     * Access to vectorDB instances from the agent for direct vectorDB interactions.
     *
     * When using vectorDB from the agent, the agent id will be used as data owner
     *
     * **Supported providers and calling patterns:**
     * - `agent.vectorDB.RAMVec()` - A local RAM vectorDB
     * - `agent.vectorDB.Pinecone()` - Pinecone vectorDB
     */
    private _vectorDBProviders: TVectorDBProviderInstances;
    public get vectorDB() {
        if (!this._vectorDBProviders) {
            this._vectorDBProviders = {} as TVectorDBProviderInstances;
            for (const provider of Object.values(TVectorDBProvider)) {
                this._vectorDBProviders[provider] = (vectorDBSettings?: any) =>
                    new VectorDBInstance(provider as TVectorDBProvider, vectorDBSettings, AccessCandidate.agent(this._data.id));
            }
        }
        return this._vectorDBProviders;
    }

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
    addSkill(settings?: TSkillSettings) {
        const component = Component.Skill(settings, this);

        return component;
    }

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
     * // Explicit execution
     * const result = await agent.prompt("Analyze this data").run();
     *
     * // Streaming for long responses
     * const stream = await agent.prompt("Write a detailed report").stream();
     * stream.on('data', chunk => console.log(chunk));
     * stream.on('end', () => console.log('Complete!'));
     * ```
     */
    public prompt(prompt: string): AgentCommand {
        return new AgentCommand(prompt, this);
    }

    /**
     * Create a new chat session with the agent.
     *
     * Chat sessions maintain conversation context and allow for back-and-forth
     * interactions with the agent, preserving message history.
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
    public chat() {
        return new Chat(this._data.defaultModel, this.data, {
            agentId: this._data.id,
        });
    }
}
