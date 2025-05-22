import { encode, encodeChat } from 'gpt-tokenizer';
import { ChatMessage } from 'gpt-tokenizer/esm/GptEncoding';
//import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
//import { CustomLLMRegistry } from '@sre/LLMManager/CustomLLMRegistry.class';
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

    // public async getContextWindow(maxTokens: number, maxOutputTokens: number = 256): Promise<any[]> {
    //     //TODO: handle non key accounts (limit tokens)
    //     // const maxModelContext = this._llmHelper?.modelInfo?.keyOptions?.tokens || this._llmHelper?.modelInfo?.tokens || 256;

    //     //#region get max model context
    //     let maxModelContext;
    //     const isStandardLLM = LLMRegistry.isStandardLLM(this.model);

    //     if (isStandardLLM) {
    //         maxModelContext = LLMRegistry.getMaxContextTokens(this.model, true); // we just provide true for hasAPIKey to get the original max context
    //     } else {
    //         const customLLMRegistry = await CustomLLMRegistry.getInstance(this.model);
    //         maxModelContext = customLLMRegistry.getMaxContextTokens(this.model);
    //     }
    //     //#endregion get max model context

    //     let maxInputContext = Math.min(maxTokens, maxModelContext);

    //     if (maxInputContext + maxOutputTokens > maxModelContext) {
    //         maxInputContext -= maxInputContext + maxOutputTokens - maxModelContext;
    //     }

    //     let messages = [];

    //     const systemMessage = { role: 'system', content: this.systemPrompt };
    //     //loop through messages from last to first and use encodeChat to calculate token lengths

    //     let tokens = encodeChat([systemMessage as ChatMessage], 'gpt-4o').length;
    //     for (let i = this._messages.length - 1; i >= 0; i--) {
    //         // internal_messages are smythOS specific intermediate formats that enable us to store certain data and only convert them when needed
    //         let internal_message: any;

    //         delete this._messages?.[i]?.['__smyth_data__']; //remove smyth data entry, this entry may hold smythOS specific data

    //         //parse specific tools messages
    //         if (this._messages[i]?.messageBlock && this._messages[i]?.toolsData) {
    //             internal_message = this.llmInference.connector
    //                 .transformToolMessageBlocks({
    //                     messageBlock: this._messages[i]?.messageBlock,
    //                     toolsData: this._messages[i]?.toolsData,
    //                 })
    //                 .reverse(); //need to reverse because we are iterating from last to first
    //         } else {
    //             internal_message = [this._messages[i] as ChatMessage];
    //         }

    //         let messageTruncated = false;

    //         for (let message of internal_message) {
    //             //skip system messages because we will add our own

    //             if (message.role === 'system') continue;

    //             //skip empty messages
    //             if (!message.content) {
    //                 //FIXME: tool call messages does not have a content but have a tool field do we need to count them as tokens ?
    //                 messages.unshift(message);
    //                 continue;
    //             }

    //             const textContent = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
    //             const encoded = encode(textContent);
    //             tokens += encoded.length;
    //             if (tokens > maxInputContext) {
    //                 if (typeof message.content !== 'string') {
    //                     //FIXME: handle this case for object contents (used by Anthropic for tool calls for example)
    //                     break;
    //                 }
    //                 //handle context window overflow
    //                 //FIXME: the logic here is weak, we need a better one
    //                 const diff = tokens - maxInputContext;
    //                 const excessPercentage = diff / encoded.length;

    //                 //truncate message content
    //                 //const textContent = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);

    //                 message.content = message.content.slice(0, Math.floor(message.content.length * (1 - excessPercentage)) - 200);

    //                 // We need to find out another way to report this
    //                 // message.content += '...\n\nWARNING : The context window has been truncated to fit the maximum token limit.';

    //                 tokens -= encoded.length;
    //                 tokens += encodeChat([message], 'gpt-4').length;

    //                 messageTruncated = true;
    //                 //break;
    //             }
    //             messages.unshift(message);
    //         }

    //         // If the message is truncated, it indicates we've reached the maximum context window. At this point, we need to stop and provide only the messages collected so far.
    //         if (messageTruncated) break;
    //     }
    //     //add system message as first message in the context window
    //     messages.unshift(systemMessage);

    //     return messages;
    // }
}
