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
        //TODO : check if the store is ready
        return this._messages;
    }

    public get model() {
        return this.llmInference.model;
    }
    /**
     *
     * @param source a messages[] object, or smyth file system uri (smythfs://...)
     */
    constructor(
        private llmInference,
        _systemPrompt: string = '',
        /*private _messages: any[] = [],*/ llmContextStore?: ILLMContextStore,
    ) {
        this._llmCache = new LLMCache(AccessCandidate.team(this.llmInference.teamId));
        //this._systemPrompt = _systemPrompt;
        this.systemPrompt = _systemPrompt;

        //TODO:allow configuring a storage service
        if (llmContextStore) {
            this._llmContextStore = llmContextStore;
            this._llmContextStore.load().then((messages) => {
                this._messages = messages;
                this._llmCache.set('messages', this._messages);
            });
        }
    }

    private push(...message: any[]) {
        this._messages.push(...message);
        //TODO: persist to storage
        if (this._llmContextStore) {
            this._llmContextStore.save(this._messages);
        }
        this._llmCache.set('messages', this._messages);
    }
    public addUserMessage(content: string, message_id: string, metadata?: any) {
        this.push({ role: 'user', content, __smyth_data__: { message_id, ...metadata } });
    }
    public addAssistantMessage(content: string, message_id: string, metadata?: any) {
        this.push({ role: 'assistant', content, __smyth_data__: { message_id, ...metadata } });
    }
    public addToolMessage(messageBlock: any, toolsData: any, message_id: string, metadata?: any) {
        this.push({ messageBlock, toolsData, __smyth_data__: { message_id, ...metadata } });
    }

    public async getContextWindow(maxTokens: number, maxOutputTokens: number = 1024): Promise<any[]> {
        const messages = JSON.parse(JSON.stringify(this._messages));
        // if (messages[0]?.role === 'system') {
        //     messages[0].content = this.systemPrompt;
        // } else {
        //     messages.unshift({ role: 'system', content: this.systemPrompt });
        // }

        return this.llmInference.getContextWindow(this.systemPrompt, messages, maxTokens, maxOutputTokens);
    }
}
