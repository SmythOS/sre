import {
    AccessCandidate,
    AgentProcess,
    BinaryInput,
    ConnectorService,
    Conversation,
    DEFAULT_TEAM_ID,
    SRE,
    TLLMConnectorParams,
    TLLMEvent,
    TLLMModel,
    TLLMProvider,
} from '@smythos/sre';
import EventEmitter from 'events';
import { Chat, prepareConversation } from '../LLM/Chat.class';
import { Component } from '../Components/Components.index';
import { ComponentWrapper } from '../Components/ComponentWrapper.class';
import { TSkillSettings } from '../Components/Skill';
import { DummyAccountHelper } from '../Security/DummyAccount.helper';

import { StorageInstance } from '../Storage/StorageInstance.class';
import { TStorageProvider, TStorageProviderInstances } from '../types/generated/Storage.types';
import { TSchedulerProvider, TSchedulerProviderInstances } from '../types/generated/Scheduler.types';
import { SchedulerInstance } from '../Scheduler/SchedulerInstance.class';
import { isFile, uid } from '../utils/general.utils';
import { SDKObject } from '../Core/SDKObject.class';
import fs from 'fs';
import { SDKLog } from '../utils/console.utils';
import { HELP, showHelp } from '../utils/help';
import { Team } from '../Security/Team.class';
import { TVectorDBProvider, TVectorDBProviderInstances } from '../types/generated/VectorDB.types';
import { VectorDBInstance } from '../VectorDB/VectorDBInstance.class';
import { TLLMInstanceFactory, TLLMProviderInstances } from '../LLM/LLM.class';
import { LLMInstance, TLLMInstanceParams } from '../LLM/LLMInstance.class';
import { AgentData, ChatOptions, Scope } from '../types/SDKTypes';
import { MCP, MCPSettings, MCPTransport } from '../MCP/MCP.class';
import { findClosestModelInfo } from '../LLM/Model';
import { VaultInstance } from '../Vault/VaultInstance.class';
import AgentMode from './mode/AgentMode';

const console = SDKLog;

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
    constructor(private prompt: string, private agent: Agent, private _options?: any) {}

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

    private async getFiles() {
        let files = [];
        if (this._options?.files) {
            files = await Promise.all(
                this._options.files.map(async (file: string) => {
                    if (isFile(file)) {
                        // Read local file using Node.js fs API with explicit null encoding to get raw binary data
                        const buffer = await fs.promises.readFile(file, null);
                        const binaryInput = BinaryInput.from(buffer);
                        await binaryInput.ready();
                        await binaryInput.upload(AccessCandidate.agent(this.agent.data.id));
                        return binaryInput;
                    } else {
                        const binaryInput = BinaryInput.from(file);
                        await binaryInput.ready();
                        await binaryInput.upload(AccessCandidate.agent(this.agent.data.id));
                        return binaryInput;
                    }
                })
            );
        }
        return files.length > 0 ? files : undefined;
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

        let files = await this.getFiles();
        const conversation = await prepareConversation(this.agent.data);

        //does this agent have any skill that is capable of handling binary files ?
        const hasBinarySkill = this.agent.data.components.find((c) => c.name === 'APIEndpoint' && c.inputs.find((i) => i.type === 'Binary'));

        const attachmentsPrompt = !files || files.length === 0 ? '' : `\n\n----\nAttachments: ${files.map((file) => ` - ${file.url}`).join('\n')}`;

        const result = await conversation
            .streamPrompt({ message: this.prompt + attachmentsPrompt, files: hasBinarySkill ? undefined : files })
            .catch((error) => {
                console.error('Error on streamPrompt: ', error);
                return JSON.stringify({ error });
            });

        return result;
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
        const files = await this.getFiles();
        const conversation = await prepareConversation(this.agent.data);

        const eventEmitter = new EventEmitter();

        const toolInfoHandler = (toolInfo: any) => {
            eventEmitter.emit(TLLMEvent.ToolInfo, toolInfo);
            this.agent.emit(TLLMEvent.ToolInfo, toolInfo);
        };
        const interruptedHandler = (interrupted: any) => {
            eventEmitter.emit(TLLMEvent.Interrupted, interrupted);
            this.agent.emit(TLLMEvent.Interrupted, interrupted);
        };

        const contentHandler = (content: string) => {
            eventEmitter.emit(TLLMEvent.Content, content);
            this.agent.emit(TLLMEvent.Content, content);
        };
        const toolCallHandler = (toolCall: any) => {
            eventEmitter.emit(TLLMEvent.ToolCall, toolCall);
            this.agent.emit(TLLMEvent.ToolCall, toolCall);
        };
        const toolResultHandler = (toolResult: any) => {
            eventEmitter.emit(TLLMEvent.ToolResult, toolResult);
            this.agent.emit(TLLMEvent.ToolResult, toolResult);
        };
        const endHandler = () => {
            eventEmitter.emit(TLLMEvent.End);
            this.agent.emit(TLLMEvent.End);
            removeHandlers();
        };
        const errorHandler = (error: any) => {
            eventEmitter.emit(TLLMEvent.Error, error);
            this.agent.emit(TLLMEvent.Error, error);
            removeHandlers();
        };
        const usageHandler = (usage: any) => {
            eventEmitter.emit(TLLMEvent.Usage, usage);
            this.agent.emit(TLLMEvent.Usage, usage);
        };

        const removeHandlers = () => {
            conversation.off(TLLMEvent.ToolCall, toolCallHandler);
            conversation.off(TLLMEvent.ToolResult, toolResultHandler);
            conversation.off(TLLMEvent.Usage, usageHandler);
            conversation.off(TLLMEvent.End, endHandler);
            conversation.off(TLLMEvent.Error, errorHandler);
            conversation.off(TLLMEvent.Content, contentHandler);
            conversation.off(TLLMEvent.ToolInfo, toolInfoHandler);
            conversation.off(TLLMEvent.Interrupted, interruptedHandler);
        };

        conversation.on(TLLMEvent.ToolCall, toolCallHandler);
        conversation.on(TLLMEvent.ToolResult, toolResultHandler);
        conversation.on(TLLMEvent.Usage, usageHandler);
        conversation.on(TLLMEvent.End, endHandler);
        conversation.on(TLLMEvent.Error, errorHandler);
        conversation.on(TLLMEvent.Content, contentHandler);
        conversation.on(TLLMEvent.ToolInfo, toolInfoHandler);
        conversation.on(TLLMEvent.Interrupted, interruptedHandler);

        conversation.streamPrompt({ message: this.prompt, files });

        return conversation;
    }

    // Future extensibility:
    // async batch(): Promise<string[]>
    // temperature(temp: number): PromptBuilder : override the modelParams
    // maxTokens(maxTokens: number): PromptBuilder : override the modelParams
    // ...
    // params(...): PromptBuilder : override the modelParams
}
export enum TAgentMode {
    DEFAULT = 'default',
    PLANNER = 'planner',
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
    /** The mode of the agent */
    mode?: TAgentMode;

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
    private _warningDisplayed = {
        storage: false,
        vectorDB: false,
        scheduler: false,
    };
    private _data: AgentData & { version: string } = {
        version: '1.0.0', //schema version
        name: '',
        behavior: '',
        defaultModel: '',
        id: '',
        teamId: DEFAULT_TEAM_ID,
        components: [],
        connections: [],
    };

    public get behavior() {
        return this._data.behavior;
    }

    public set behavior(behavior: string) {
        this._data.behavior = behavior;
    }

    /**
     * The agent internal structure
     * used for by internal operations to generate the agent data
     */
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

    /**
     * The agent data : this is the equivalent of the .smyth file content.
     *
     * Used for by external operations to get the agent data
     */
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

        const { model, mode, ...rest } = this._settings;

        this._data.defaultModel = model as any;

        for (let key in rest) {
            this._data[key as keyof AgentData] = rest[key];
        }

        //when creating a new agent, we make sure to create new unique id
        if (!this._data.id) {
            //console.warn('No id provided for the agent, generating a new one');
            this._data.id = this._normalizeId(`${this._data.name ? this._data.name + '-' : ''}${uid()}`);
        } else {
            if (!this._validateId(this._data.id)) {
                throw new Error(`Invalid agent id: ${this._data.id}\nOnly alphanumeric, hyphens and underscores are allowed`);
            }
            this._hasExplicitId = true;
        }

        //use default team id for the SDK
        if (!this._data.teamId) {
            if (!this._validateId(this._data.id)) {
                throw new Error(`Invalid agent id: ${this._data.id}\nOnly alphanumeric, hyphens and underscores are allowed`);
            }
            //console.warn('No team id provided for the agent, using default team id');
            this._data.teamId = DEFAULT_TEAM_ID;
        }

        this._data.teamId = this._data.teamId || DEFAULT_TEAM_ID;

        //if we are using DummyAccount, populate the account data in order to inform it about our newly loaded agent
        DummyAccountHelper.addAgentToTeam(this._data.id, this._data.teamId);

        if (mode) {
            this.addMode(mode);
        }

        if (rest.imported) {
            ConnectorService.getAgentDataConnector().setEphemeralAgentData(this._data.id, this._data);
        }
    }

    protected async init() {
        //if the SRE instance is not initializing, initialize it with default settings
        if (!SRE.initializing) SRE.init({});
        await SRE.ready();

        const model = this._data.defaultModel;

        const modelsProvider = ConnectorService.getModelsProviderConnector();
        const modelsProviderReq = modelsProvider.agent(this._data.id);

        const models = await modelsProviderReq.getModels();

        if (typeof model === 'string') {
            this._data.defaultModel = findClosestModelInfo(models, model);
        } else {
            this._data.defaultModel = model as any;
            const builtInModelInfo = findClosestModelInfo(models, model.modelId);
            if (builtInModelInfo) {
                this._data.defaultModel = {
                    ...builtInModelInfo,
                    ...(this._data.defaultModel as any),
                };
            }
        }
        this._readyPromise.resolve(true);
    }

    private _validateId(id: string) {
        //only accept alphanumeric, hyphens and underscores
        return id.length > 0 && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id);
    }
    private _normalizeId(name: string) {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
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
            imported: true,
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
                        return new LLMInstance(
                            TLLMProvider[provider],
                            {
                                model: modelIdOrParams,
                                ...modelParams,
                            },
                            AccessCandidate.agent(this._data.id)
                        );
                    } else {
                        // Second signature: (modelParams: TLLMInstanceParams)
                        return new LLMInstance(TLLMProvider[provider], modelIdOrParams, AccessCandidate.agent(this._data.id));
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
     * - `agent.storage.default()` - Default storage provider
     * - `agent.storage.LocalStorage()` - Local storage
     * - `agent.storage.S3()` - S3 storage
     *
     * @example
     * ```typescript
     * // Direct storage access
     * const defaultStorage = agent.storage.default();
     * const local = agent.storage.LocalStorage();
     * const s3 = agent.storage.S3();
     * ```
     */
    private _storageProviders: TStorageProviderInstances;

    public get storage() {
        if (!this._storageProviders) {
            this._storageProviders = {} as TStorageProviderInstances;
            for (const provider of Object.values(TStorageProvider)) {
                this._storageProviders[provider] = (storageSettings?: any, scope?: Scope | AccessCandidate) => {
                    const { scope: _scope, ...connectorSettings } = storageSettings || {};
                    if (!scope) scope = _scope;
                    if (scope !== Scope.TEAM && !this._hasExplicitId && !this._warningDisplayed.storage) {
                        this._warningDisplayed.storage = true;
                        console.warn(
                            `You are performing storage operations with an unidentified agent.\nThe data will be associated with the agent's team (Team ID: "${this._data.teamId}"). If you want to associate the data with the agent, please set an explicit agent ID.\n${HELP.SDK.AGENT_STORAGE_ACCESS}`
                        );
                    }
                    const candidate =
                        scope !== Scope.TEAM && this._hasExplicitId ? AccessCandidate.agent(this._data.id) : AccessCandidate.team(this._data.teamId);

                    return new StorageInstance(provider as TStorageProvider, connectorSettings, candidate);
                };
            }
        }

        return this._storageProviders;
    }

    /**
     * Access to vectorDB instances from the agent for direct vectorDB interactions.
     *
     * When using vectorDB from the agent, the agent id will be used as data owner
     *
     * **Supported providers and calling patterns:**
     * - `agent.vectorDB.default()` - Default vectorDB provider (RAMVec)
     * - `agent.vectorDB.RAMVec()` - A local RAM vectorDB
     * - `agent.vectorDB.Pinecone()` - Pinecone vectorDB
     */
    private _vectorDBProviders: TVectorDBProviderInstances;
    public get vectorDB() {
        if (!this._vectorDBProviders) {
            this._vectorDBProviders = {} as TVectorDBProviderInstances;
            for (const provider of Object.values(TVectorDBProvider)) {
                this._vectorDBProviders[provider] = (namespace: string, vectorDBSettings?: any, scope?: Scope | AccessCandidate) => {
                    const { scope: _scope, ...connectorSettings } = vectorDBSettings || {};
                    if (!scope) scope = _scope;

                    if (scope !== Scope.TEAM && !this._hasExplicitId && !this._warningDisplayed.vectorDB) {
                        this._warningDisplayed.vectorDB = true;
                        console.warn(
                            `You are performing vectorDB operations with an unidentified agent.\nThe vectors will be associated with the agent's team (Team ID: "${this._data.teamId}"). If you want to associate the vectors with the agent, please set an explicit agent ID.\n${HELP.SDK.AGENT_VECTORDB_ACCESS}`
                        );
                    }
                    const candidate =
                        scope !== Scope.TEAM && this._hasExplicitId ? AccessCandidate.agent(this._data.id) : AccessCandidate.team(this._data.teamId);
                    return new VectorDBInstance(provider as TVectorDBProvider, { ...connectorSettings, namespace }, candidate);
                };
            }
        }

        return this._vectorDBProviders;
    }

    /**
     * Access to scheduler instances from the agent for direct scheduler interactions.
     *
     * When using scheduler from the agent, the agent id will be used as job owner
     *
     * **Supported providers and calling patterns:**
     * - `agent.scheduler.default()` - Default scheduler provider (LocalScheduler)
     * - `agent.scheduler.LocalScheduler()` - Local scheduler
     *
     * @example
     * ```typescript
     * // Direct scheduler access
     * const scheduler = agent.scheduler.default();
     *
     * // Add a scheduled job
     * await scheduler.add('health-check',
     *   Schedule.every('5m'),
     *   new Job(async () => {
     *     console.log('Checking health...');
     *   }, { name: 'Health Check' })
     * );
     * ```
     */
    private _schedulerProviders: TSchedulerProviderInstances;
    public get scheduler() {
        if (!this._schedulerProviders) {
            this._schedulerProviders = {} as TSchedulerProviderInstances;
            for (const provider of Object.values(TSchedulerProvider)) {
                this._schedulerProviders[provider] = (schedulerSettings?: any, scope?: Scope | AccessCandidate) => {
                    const { scope: _scope, ...connectorSettings } = schedulerSettings || {};
                    if (!scope) scope = _scope;

                    if (scope !== Scope.TEAM && !this._hasExplicitId && !this._warningDisplayed.scheduler) {
                        this._warningDisplayed.scheduler = true;
                        console.warn(
                            `You are performing scheduler operations with an unidentified agent.\nThe jobs will be associated with the agent's team (Team ID: "${this._data.teamId}"). If you want to associate the jobs with the agent, please set an explicit agent ID.\n${HELP.SDK.AGENT_STORAGE_ACCESS}`
                        );
                    }
                    const candidate =
                        scope !== Scope.TEAM && this._hasExplicitId ? AccessCandidate.agent(this._data.id) : AccessCandidate.team(this._data.teamId);
                    return new SchedulerInstance(provider as TSchedulerProvider, connectorSettings, candidate);
                };
            }
        }

        return this._schedulerProviders;
    }

    private _vault: VaultInstance;

    /**
     * Access to the agent's team vault
     *
     * This will give you access to the current agent team vault, if no explicit team is set, the agent belongs to "default" team.
     *
     * @example
     * ```typescript
     * const value = await agent.vault.get('my-key');
     * ```
     *
     * @returns The vault instance
     */
    public get vault() {
        if (!this._vault) {
            this._vault = new VaultInstance(AccessCandidate.agent(this._data.id));
        }
        return this._vault;
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

    async call(skillName: string, ...args: (Record<string, any> | any)[]) {
        try {
            const _agentData = this.data;
            const skill = _agentData.components.find((c) => c.data.endpoint === skillName);

            // if (skill?.process) {
            //     const processSkill: ComponentWrapper = this.structure.components.find(
            //         (c: ComponentWrapper) => c?.internalData?.process && c?.data?.data?.endpoint === skillName
            //     );

            //     const handler = processSkill?.internalData?.process || (() => null);

            //     const result = await handler(...args);

            //     return result;
            // }

            // const filteredAgentData = {
            //     ..._agentData,
            //     components: _agentData.components.filter((c) => !c.process),
            // };

            const filteredAgentData = {
                ..._agentData,
                components: _agentData.components,
            };

            const method = skill.data.method.toUpperCase();
            const path = `/api/${skillName}`;
            const headers = {
                'Content-Type': 'application/json',
            };

            const input = args[0];
            const body =
                method === 'POST'
                    ? {
                          ...input,
                      }
                    : undefined;
            const query =
                method === 'GET'
                    ? {
                          ...input,
                      }
                    : undefined;

            const agent = AgentProcess.load(filteredAgentData);
            return await agent.run({ method, path, body, query, headers });
        } catch (error) {
            console.error(`Error executing skill '${skillName}':`, error.message);
            throw error;
        }
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
     *
     * // Streaming for long responses
     * const stream = await agent.prompt("Write a detailed report").stream();
     * stream.on('data', chunk => console.log(chunk));
     * stream.on('end', () => console.log('Complete!'));
     * ```
     */
    public prompt(prompt: string, options?: any): AgentCommand {
        return new AgentCommand(prompt, this, options);
    }

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
    public chat(options?: ChatOptions | string) {
        //TODO/FUTURE: add the possibility to customize the chat persistence system
        //Currently we are persisting the chat messages in the default storage provider of the agent

        if (typeof options === 'string') {
            options = { id: options, persist: true };
        }

        const chatOptions = {
            ...options,
            candidate: this._hasExplicitId ? AccessCandidate.agent(this._data.id) : AccessCandidate.team(this._data.teamId),
        };

        if (chatOptions.persist && !this._hasExplicitId) {
            console.warn(
                '!! Persistance is disabled !! Reason: You are creating a chat session with an unidentified agent.',
                '\nSet an explicit agent ID or set the shared option to true'
            );
            showHelp(HELP.SDK.CHAT_PERSISTENCE);

            chatOptions.persist = false;
        }

        if (!chatOptions.model) {
            chatOptions.model = this._data.defaultModel;
        }
        return new Chat(chatOptions, this.data, {
            agentId: this._data.id,
            baseUrl: chatOptions.baseUrl,
        });
    }

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
    public async mcp(transport: MCPTransport, port: number = 3388) {
        const instance = new MCP(this);
        return await instance.start({ transport, port });
    }

    /**
     * Set the operational mode of the agent.
     * an operational mode is a set of skills that are applied to the agent to change its behavior.
     *
     * @example
     * ```typescript
     * agent.setMode(TAgentMode.PLANNER);
     * //or
     * agent.addMode('planner');
     * ```
     *
     * @param mode - The mode to apply, currently only "planner" is supported
     */
    public addMode(mode: TAgentMode) {
        if (typeof AgentMode?.[mode]?.apply === 'function') {
            AgentMode[mode].apply(this);
        } else {
            console.warn(`Mode ${mode} is not a valid mode, skipping...`);
        }
    }
}
