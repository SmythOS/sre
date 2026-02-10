import { TLLMModel, Conversation, TLLMEvent, ILLMContextStore, AccessCandidate } from '@smythos/sre';
import { EventEmitter } from 'events';
import { uid } from '../utils/general.utils';
import { AgentData, ChatOptions, PromptOptions } from '../types/SDKTypes';
import { SDKObject } from '../Core/SDKObject.class';
import { StorageInstance } from '../Storage/StorageInstance.class';
import { SDKLog } from '../utils/console.utils';
import type { Agent, TAgentMode } from '../Agent/Agent.class';
const console = SDKLog;

class LocalChatStore extends SDKObject implements ILLMContextStore {
    private _storage: StorageInstance;
    public get id() {
        return this._conversationId;
    }
    constructor(
        private _conversationId: string,
        candidate: AccessCandidate,
    ) {
        super();
        this._storage = new StorageInstance(null, null, candidate);
    }
    async save(messages: any[]): Promise<void> {
        try {
            await this._storage.write(`${this._conversationId}`, JSON.stringify(messages));
        } catch (error) {
            console.error('Error saving chat messages: ', error);
            throw error;
        }
    }
    async load(count?: number): Promise<any[]> {
        try {
            const buffer: Buffer = await this._storage.read(`${this._conversationId}`);
            if (!buffer) return [];
            const messages = JSON.parse(buffer.toString());
            return messages;
        } catch (error) {
            console.error('Error loading chat messages: ', error);
            throw error;
        }
    }
    async getMessage(message_id: string): Promise<any[]> {
        const messages = await this.load();
        const message = messages.find((m) => m.__smyth_data__?.message_id === message_id);

        return message;
    }
}
class ChatCommand {
    private _conversation: Conversation;

    constructor(
        private prompt: string,
        private chat: Chat,
        private options?: PromptOptions,
    ) {
        this._conversation = chat._conversation;
    }

    then(resolve: (value: string) => void, reject?: (reason: any) => void) {
        return this.run().then(resolve, reject);
    }

    private async run(): Promise<string> {
        await this.chat.ready;
        await this._conversation.ready; //when we switch agent mode at runtime, we need to wait for the conversation to be ready
        const result = await this._conversation.streamPrompt(
            this.prompt,
            this.options?.headers,
            this.options?.concurrentCalls,
            this.options?.abortSignal,
        );
        return result;
    }

    /**
     * Execute the chat command as a streaming response.
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
     * const chat = agent.chat('my_chat_id');
     *
     * const stream = await chat.prompt("Tell me a long story").stream();
     * stream.on('data', (chunk) => process.stdout.write(chunk));
     * stream.on('end', () => console.log('\nStory completed!'));
     * stream.on('error', (err) => console.error('Error:', err));
     * ```
     */
    async stream(): Promise<EventEmitter> {
        await this.chat.ready;
        await this._conversation.ready; //when we switch agent mode at runtime, we need to wait for the conversation to be ready

        const eventEmitter = new EventEmitter();

        const toolInfoHandler = (toolInfo: any) => {
            eventEmitter.emit(TLLMEvent.ToolInfo, toolInfo);
            this.chat.emit(TLLMEvent.ToolInfo, toolInfo);
        };
        const interruptedHandler = (interrupted: any) => {
            eventEmitter.emit(TLLMEvent.Interrupted, interrupted);
            this.chat.emit(TLLMEvent.Interrupted, interrupted);
        };

        const dataHandler = (data: any) => {
            eventEmitter.emit(TLLMEvent.Data, data);
            this.chat.emit(TLLMEvent.Data, data);
        };

        const contentHandler = (content: string) => {
            eventEmitter.emit(TLLMEvent.Content, content);
            this.chat.emit(TLLMEvent.Content, content);
        };
        const toolCallHandler = (toolCall: any) => {
            eventEmitter.emit(TLLMEvent.ToolCall, toolCall);
            this.chat.emit(TLLMEvent.ToolCall, toolCall);
        };
        const toolResultHandler = (toolResult: any) => {
            eventEmitter.emit(TLLMEvent.ToolResult, toolResult);
            this.chat.emit(TLLMEvent.ToolResult, toolResult);
        };
        const endHandler = () => {
            eventEmitter.emit(TLLMEvent.End);
            this.chat.emit(TLLMEvent.End);
            removeHandlers();
        };
        const errorHandler = (error: any) => {
            eventEmitter.emit(TLLMEvent.Error, error);
            this.chat.emit(TLLMEvent.Error, error);
            removeHandlers();
        };
        const usageHandler = (usage: any) => {
            eventEmitter.emit(TLLMEvent.Usage, usage);
            this.chat.emit(TLLMEvent.Usage, usage);
        };

        const removeHandlers = () => {
            this._conversation.off(TLLMEvent.ToolCall, toolCallHandler);
            this._conversation.off(TLLMEvent.ToolResult, toolResultHandler);
            this._conversation.off(TLLMEvent.Usage, usageHandler);
            this._conversation.off(TLLMEvent.End, endHandler);
            this._conversation.off(TLLMEvent.Error, errorHandler);
            this._conversation.off(TLLMEvent.Content, contentHandler);
            this._conversation.off(TLLMEvent.ToolInfo, toolInfoHandler);
            this._conversation.off(TLLMEvent.Interrupted, interruptedHandler);
            this._conversation.off(TLLMEvent.Data, dataHandler);
        };

        this._conversation.on(TLLMEvent.ToolCall, toolCallHandler);
        this._conversation.on(TLLMEvent.ToolResult, toolResultHandler);
        this._conversation.on(TLLMEvent.Usage, usageHandler);
        this._conversation.on(TLLMEvent.End, endHandler);
        this._conversation.on(TLLMEvent.Error, errorHandler);
        this._conversation.on(TLLMEvent.Content, contentHandler);
        this._conversation.on(TLLMEvent.ToolInfo, toolInfoHandler);
        this._conversation.on(TLLMEvent.Interrupted, interruptedHandler);
        this._conversation.on(TLLMEvent.Data, dataHandler);

        // Start the streaming process - don't await as we want to return the eventEmitter immediately
        this._conversation
            .streamPrompt(this.prompt, this.options?.headers, this.options?.concurrentCalls, this.options?.abortSignal)
            .catch((error) => {
                eventEmitter.emit(TLLMEvent.Error, error);
            });
        return eventEmitter;
    }
}

export class Chat extends SDKObject {
    private _id: string;
    public _conversation: Conversation;
    /**
     * The SRE Conversation Manager instance that is used to handle the current chat conversation.
     */
    public get conversation() {
        return this._conversation;
    }

    private _curAgentModes: string = '';

    public get id() {
        return this._id;
    }

    private _emptyData: any = {
        version: '1.0.0',
        name: 'Agent',
        behavior: '',
        components: [],
        connections: [],
        defaultModel: '',
        id: uid(),
    };
    private _data: any = {};
    public get agentData() {
        return this._data;
    }
    constructor(
        options: ChatOptions & { candidate: AccessCandidate },
        private source?: Agent | Record<string, any>,
        private _convOptions: any = {},
    ) {
        super();

        const _data = source?.data || source || {};

        const _model = options.model || _data?.defaultModel || '';
        this._data = { ...this._emptyData, ..._data, defaultModel: _model };

        this._id = options.id || uid();
        if (options.persist) {
            if (!options.candidate) {
                //no explicit id provided, generaed Agent IDs are not eligible for persistance
                console.warn('Agent ID or Team ID are required to use chat persistance.');
                console.warn('Chat persistance disabled!');
            } else {
                if (!this._convOptions?.store && typeof options.persist === 'boolean') {
                    this._convOptions.store = new LocalChatStore(this._id, options.candidate);
                }

                if (!this._convOptions?.store && this.isValidPersistanceObject(options.persist)) {
                    this._convOptions.store = options.persist;
                }
            }
        }

        if (options.maxContextSize) {
            this._convOptions.maxContextSize = options.maxContextSize;
        }
        if (options.maxOutputTokens) {
            this._convOptions.maxOutputTokens = options.maxOutputTokens;
        }

        if ((this.source as Agent)?.modes) {
            this._curAgentModes = (this.source as Agent).modes.join('|');
        }
        this._conversation = createConversation(this._data, this._convOptions);
    }

    private isValidPersistanceObject(persistance: any) {
        return typeof persistance === 'object' && 'save' in persistance && 'load' in persistance && 'getMessage' in persistance;
    }
    protected async init() {
        await super.init();

        await registerProcessSkills(this._conversation, this._data);
    }

    /**
     * Send a prompt to the chat and get a response.
     *
     * The returned command can be executed in multiple ways:
     * - **Promise mode**: `await chat.prompt("question")` - returns final result
     * - **Explicit execution**: `await chat.prompt("question").run()` - same as above
     * - **Streaming mode**: `await chat.prompt("question").stream()` - returns event emitter
     *
     * @example
     * ```typescript
     * const chat = agent.chat('my_chat_id');
     *
     * // Simple prompt (promise mode)
     * const answer = await chat.prompt("What is the capital of France?");
     *
     *
     * // Streaming for long responses
     * const stream = await chat.prompt("Write a detailed report").stream();
     * stream.on('data', chunk => console.log(chunk));
     * stream.on('end', () => console.log('Complete!'));
     * ```
     *
     * @param prompt - The message or question to send to the chat
     * @returns ChatCommand that can be executed or streamed
     */
    prompt(prompt: string, options?: PromptOptions) {
        if ((this.source as Agent)?.modes) {
            const modes = (this.source as Agent).modes.join('|');
            if (modes !== this._curAgentModes) {
                //agent mode changed we need to recreate the conversation object
                const _data = this.source.data || this.source;
                const _model = this._data?.defaultModel || '';
                this._data = { ...this._emptyData, ..._data, defaultModel: _model };

                //this._conversation = createConversation(this._data, this._convOptions);
                this._conversation.spec = this._data;
                this._curAgentModes = modes;
            }
        }
        return new ChatCommand(prompt, this, options);
    }
}

function createConversation(agentData: AgentData, options?: any) {
    const filteredAgentData = {
        ...agentData,
        components: agentData.components, //agentData.components.filter((c) => !c.process),
    };
    const conversation = new Conversation(agentData.defaultModel, filteredAgentData, {
        agentId: agentData.id,
        ...options,
    });

    conversation.on(TLLMEvent.Error, (error) => {
        console.error('An error occurred while running the agent: ', error.message, error.stack);
    });

    return conversation;
}

async function registerProcessSkills(conversation: Conversation, agentData: AgentData) {
    // await conversation.ready;
    // const processSkills: any[] = agentData.components.filter((c) => c.process);
    // for (const skill of processSkills) {
    //     await conversation.addTool({
    //         name: skill.data.endpoint,
    //         description: skill.data.description,
    //         //arguments: _arguments,
    //         handler: skill.process,
    //         inputs: skill.inputs,
    //     });
    // }
}

export async function prepareConversation(agentData: AgentData, options?: any) {
    const conversation = createConversation(agentData, options);
    // Register process skills as custom tools
    await registerProcessSkills(conversation, agentData);
    return conversation;
}
