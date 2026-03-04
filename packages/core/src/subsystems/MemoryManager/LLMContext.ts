import { encode, encodeChat } from 'gpt-tokenizer';
import { ChatMessage } from 'gpt-tokenizer/esm/GptEncoding';
import { ILLMContextStore } from '@sre/types/LLM.types';
import { LLMCache } from './LLMCache';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

//content, name, role, tool_call_id, tool_calls, function_call
export class LLMContext {
    private _systemPrompt: string = '';
    private _llmContextStore: ILLMContextStore;
    private _llmCache: LLMCache;

    /** Resolves when the context store has finished loading (if any). Safe to call before using addUserMessage, getContextWindow, or other context operations. */
    private _readyPromise: Promise<void>;

    public get systemPrompt() {
        return this._systemPrompt;
    }
    public set systemPrompt(systemPrompt) {
        this._systemPrompt = systemPrompt;
        this._llmCache?.set('systemPrompt', this.systemPrompt);
    }

    public get llmCache() {
        return this._llmCache;
    }

    public contextLength: number;

    private _messages: any[] = [];
    public get messages() {
        return this._messages;
    }

    public get model() {
        return this.llmInference.model;
    }
    /**
     *
     * @param source a messages[] object, or smyth file system uri (smythfs://...)
     */
    constructor(private llmInference, _systemPrompt: string = '', llmContextStore?: ILLMContextStore) {
        this._llmCache = new LLMCache(AccessCandidate.team(this.llmInference.teamId));

        //this._systemPrompt = _systemPrompt;
        this.systemPrompt = _systemPrompt;

        if (llmContextStore) {
            this._llmContextStore = llmContextStore;
            this._readyPromise = this._llmContextStore.load().then((messages) => {
                this._messages = messages;
                this._llmCache.set('messages', this._messages);
            });
        } else {
            this._readyPromise = Promise.resolve();
        }
    }

    /**
     * Returns a promise that resolves when the context is ready (store loaded if present).
     * Call before pushing or reading messages to avoid race conditions.
     */
    public ready(): Promise<void> {
        return this._readyPromise;
    }

    private async push(...message: any[]) {
        await this.ready();
        this._messages.push(...message);

        if (this._llmContextStore) {
            this._llmContextStore.save(this._messages);
        }
        this._llmCache.set('messages', this._messages);
    }
    public async addUserMessage(content: string, message_id: string, metadata?: any): Promise<void> {
        await this.ready();
        //in the current implementation, we do not support forked conversations
        //we always attatch to the last message in the queue

        //TODO: implement forked conversations ==> might require updating the interfaces in order to support passing previous message_id explicitly
        const lastMessage = this._messages[this._messages.length - 1];

        if (lastMessage) {
            if (!lastMessage.__smyth_data__?.next) {
                lastMessage.__smyth_data__.next = [];
            }
            lastMessage.__smyth_data__.next.push(message_id);
        }

        const prev = lastMessage?.__smyth_data__?.message_id;
        const next = [];

        await this.push({ role: 'user', content, __smyth_data__: { message_id, ...metadata, prev, next } });
    }
    public async addAssistantMessage(content: string, message_id: string, metadata?: any): Promise<void> {
        await this.ready();
        const lastMessage = this._messages[this._messages.length - 1];

        if (lastMessage) {
            if (!lastMessage.__smyth_data__?.next) {
                lastMessage.__smyth_data__.next = [];
            }
            lastMessage.__smyth_data__.next.push(message_id);
        }

        const prev = lastMessage?.__smyth_data__?.message_id;
        const next = [];
        await this.push({ role: 'assistant', content, __smyth_data__: { message_id, ...metadata, prev, next } });
    }
    public async addToolMessage(messageBlock: any, toolsData: any, message_id: string, metadata?: any): Promise<void> {
        await this.ready();
        const lastMessage = this._messages[this._messages.length - 1];

        if (lastMessage) {
            if (!lastMessage.__smyth_data__?.next) {
                lastMessage.__smyth_data__.next = [];
            }
            lastMessage.__smyth_data__.next.push(message_id);
        }

        const prev = lastMessage?.__smyth_data__?.message_id;
        const next = [];
        await this.push({ messageBlock, toolsData, __smyth_data__: { message_id, ...metadata, prev, next } });
    }

    public async getContextWindow(maxTokens: number, maxOutputTokens: number = 1024): Promise<any[]> {
        await this.ready();
        const messages = JSON.parse(JSON.stringify(this._messages));
        // if (messages[0]?.role === 'system') {
        //     messages[0].content = this.systemPrompt;
        // } else {
        //     messages.unshift({ role: 'system', content: this.systemPrompt });
        // }

        return this.llmInference.getContextWindow(this.systemPrompt, messages, maxTokens, maxOutputTokens);
    }
}
