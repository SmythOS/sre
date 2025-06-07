import { Conversation } from '@sre/helpers/Conversation.helper';
import { uid } from '@sre/utils/general.utils';
import { Component } from './components/components.index';
import { TSkillSettings } from './components/Skill';
import EventEmitter from 'events';
import { ComponentWrapper } from './components/ComponentWrapper.class';
import * as acorn from 'acorn';
import { Chat } from './Chat.class';
import { TLLMConnectorParams, TLLMEvent, TLLMModel, TLLMProvider } from '@sre/types/LLM.types';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { adaptModelParams, LLM, LLMInstance, TLLMInstanceFactory, TLLMInstanceParams, TLLMProviderInstances, TModelFactory } from './LLM.class';
import { DEFAULT_TEAM_ID } from '@sre/types/ACL.types';
import { StorageInstance } from './Storage.class';
import { TStorageProvider, TStorageProviderInstances } from './types/generated/Storage.types';
import { DummyAccountHelper } from './DummyAccount.helper';

import fs from 'fs';
import { SDKLog } from './utils/console.utils';

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
    constructor(
        private prompt: string,
        private agent: Agent,
    ) {}

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
        // Find all skills with process functions and register them as tools
        const processSkills = this.agent.structure.components.filter((c: ComponentWrapper) => c.internalData.process);

        for (const skill of processSkills) {
            //transforming a process function to a conversation tool
            //TODO : move this logic to the Conversation manager
            const process = skill.internalData.process;
            const openApiArgs = extractArgsAsOpenAPI(process);
            const _arguments = {};
            for (let arg of openApiArgs) {
                _arguments[arg.name] = arg.schema;
            }

            const handler = async (argsObj) => {
                const args = Object.values(argsObj);
                const result = await process(...args);
                return result;
            };
            await conversation.addTool({
                name: skill.data.data.endpoint,
                description: skill.data.data.description,
                arguments: _arguments,
                handler,
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
export class Agent {
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

    public get data(): AgentData {
        //console.log(this.structure);
        const data = {
            ...this._data,
        };

        for (let c of this.structure.components) {
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
     * @param settings - Configuration object for the agent
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
    constructor(settings: TAgentSettings) {
        const { model, ...rest } = settings;
        this._data.defaultModel = model as string;

        for (let key in rest) {
            this._data[key] = rest[key];
        }

        //when creating a new agent, we make sure to create new unique id
        if (!this._data.id) {
            console.warn('No id provided for the agent, generating a new one');
            this._data.id = uid();
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
    static import(data: TAgentSettings);
    static import(data: string, overrides?: any);
    static import(data: string | TAgentSettings, overrides?: TAgentSettings) {
        if (typeof data === 'string' && fs.existsSync(data)) {
            data = JSON.parse(fs.readFileSync(data, 'utf8')) as TAgentSettings;

            //when importing a .smyth file we need to override the id and teamId
            data.id = uid();
            data.teamId = DEFAULT_TEAM_ID;
        }

        const _data = { ...(data as TAgentSettings), ...(overrides as TAgentSettings) };
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
     * - `agent.llm.provider({ model: modelId, ...params })` - Configuration object
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
                        return new LLMInstance(TLLMProvider[provider], { model: modelIdOrParams, ...modelParams });
                    } else {
                        // Second signature: (modelParams: TLLMInstanceParams)
                        return new LLMInstance(TLLMProvider[provider], modelIdOrParams);
                    }
                }) as TLLMInstanceFactory;
            }
        }
        return this._llmProviders;
    }

    private _storageProviders: TStorageProviderInstances;

    public get storage() {
        if (!this._storageProviders) {
            this._storageProviders = {} as TStorageProviderInstances;
            for (const provider of Object.values(TStorageProvider)) {
                this._storageProviders[provider] = (storageSettings?: any) =>
                    new StorageInstance(provider as TStorageProvider, storageSettings, AccessCandidate.agent(this._data.id));
            }
        }
        return this._storageProviders;
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

function extractArgsAsOpenAPI(fn) {
    const ast = acorn.parse(`(${fn.toString()})`, { ecmaVersion: 'latest' });
    const params = (ast.body[0] as any).expression.params;

    let counter = 0;
    function handleParam(param) {
        if (param.type === 'Identifier') {
            return {
                name: param.name,
                in: 'query',
                required: true,
                schema: { type: 'string' },
            };
        }

        if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') {
            return {
                name: param.left.name,
                in: 'query',
                required: false,
                schema: { type: 'string' },
            };
        }

        if (param.type === 'RestElement' && param.argument.type === 'Identifier') {
            return {
                name: param.argument.name,
                in: 'query',
                required: false,
                schema: { type: 'array', items: { type: 'string' } },
            };
        }

        if (param.type === 'ObjectPattern') {
            // For destructured objects, output as a single parameter with nested fields
            return {
                name: `[object_${counter++}]`,
                in: 'query',
                required: true,
                schema: {
                    type: 'object',
                    properties: Object.fromEntries(
                        param.properties.map((prop) => {
                            const keyName = prop.key.name || '[unknown]';
                            return [keyName, { type: 'string' }]; // default to string
                        }),
                    ),
                },
            };
        }

        return {
            name: `[unknown_${counter++}]`,
            in: 'query',
            required: true,
            schema: { type: 'string' },
        };
    }

    return params.map(handleParam);
}
