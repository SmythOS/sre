import { TLLMModel, Conversation, TLLMEvent, ILLMContextStore, AccessCandidate } from '@smythos/sre';
import { EventEmitter } from 'events';
import { uid } from './utils/general.utils';
import { AgentData, ChatOptions } from './types/SDKTypes';
import { SDKObject } from './SDKObject.class';
import { StorageInstance } from './Storage.class';
import { SDKLog } from './utils/console.utils';

const console = SDKLog;

class LocalChatStore extends SDKObject implements ILLMContextStore {
    private _storage: StorageInstance;
    constructor(private _conversationId: string, candidate: AccessCandidate) {
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

    constructor(private prompt: string, private chat: Chat) {
        this._conversation = chat._conversation;
    }

    then(resolve: (value: string) => void, reject?: (reason: any) => void) {
        return this.run().then(resolve, reject);
    }

    private async run(): Promise<string> {
        await this.chat.ready;
        const result = await this._conversation.streamPrompt(this.prompt);
        return result;
    }

    async stream(): Promise<EventEmitter> {
        await this.chat.ready;
        this._conversation.streamPrompt(this.prompt);
        //return this._conversation;

        const eventEmitter = new EventEmitter();

        const toolInfoHandler = (toolInfo: any) => {
            eventEmitter.emit(TLLMEvent.ToolInfo, toolInfo);
        };
        const interruptedHandler = (interrupted: any) => {
            eventEmitter.emit(TLLMEvent.Interrupted, interrupted);
        };

        const contentHandler = (content: string) => {
            eventEmitter.emit(TLLMEvent.Content, content);
        };
        const toolCallHandler = (toolCall: any) => {
            eventEmitter.emit(TLLMEvent.ToolCall, toolCall);
        };
        const toolResultHandler = (toolResult: any) => {
            eventEmitter.emit(TLLMEvent.ToolResult, toolResult);
        };
        const endHandler = () => {
            eventEmitter.emit(TLLMEvent.End);
            removeHandlers();
        };
        const errorHandler = (error: any) => {
            eventEmitter.emit(TLLMEvent.Error, error);
            removeHandlers();
        };
        const usageHandler = (usage: any) => {
            eventEmitter.emit(TLLMEvent.Usage, usage);
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
        };

        this._conversation.on(TLLMEvent.ToolCall, toolCallHandler);
        this._conversation.on(TLLMEvent.ToolResult, toolResultHandler);
        this._conversation.on(TLLMEvent.End, endHandler);
        this._conversation.on(TLLMEvent.Error, errorHandler);
        this._conversation.on(TLLMEvent.Content, contentHandler);
        this._conversation.on(TLLMEvent.ToolInfo, toolInfoHandler);
        this._conversation.on(TLLMEvent.Interrupted, interruptedHandler);

        return eventEmitter;
    }
}

export class Chat extends SDKObject {
    private _id: string;
    public _conversation: Conversation;

    public get id() {
        return this._id;
    }

    private _data: any = {
        version: '1.0.0',
        name: 'Agent',
        behavior: '',
        components: [],
        connections: [],
        defaultModel: '',
        id: uid(),
    };
    public get agentData() {
        return this._data;
    }
    constructor(options: ChatOptions & { candidate: AccessCandidate }, _model: string | TLLMModel, _data?: any, private _convOptions: any = {}) {
        super();

        this._data = { ...this._data, ..._data, defaultModel: _model };

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

        this._conversation = createConversation(this._data, this._convOptions);
    }

    private isValidPersistanceObject(persistance: any) {
        return typeof persistance === 'object' && 'save' in persistance && 'load' in persistance && 'getMessage' in persistance;
    }
    protected async init() {
        await super.init();

        await registerProcessSkills(this._conversation, this._data);
    }

    prompt(prompt: string) {
        return new ChatCommand(prompt, this);
    }
}

function createConversation(agentData: AgentData, options?: any) {
    const filteredAgentData = {
        ...agentData,
        components: agentData.components.filter((c) => !c.process),
    };
    const conversation = new Conversation(agentData.defaultModel, filteredAgentData, {
        agentId: agentData.id,
        ...options,
    });

    conversation.on(TLLMEvent.Error, (error) => {
        console.error('An error occurred while running the agent: ', error.message);
    });

    return conversation;
}

async function registerProcessSkills(conversation: Conversation, agentData: AgentData) {
    const processSkills: any[] = agentData.components.filter((c) => c.process);
    for (const skill of processSkills) {
        await conversation.addTool({
            name: skill.data.endpoint,
            description: skill.data.description,
            //arguments: _arguments,
            handler: skill.process,
            inputs: skill.inputs,
        });
    }
}

export async function prepareConversation(agentData: AgentData, options?: any) {
    const conversation = createConversation(agentData, options);
    // Register process skills as custom tools
    await registerProcessSkills(conversation, agentData);
    return conversation;
}
