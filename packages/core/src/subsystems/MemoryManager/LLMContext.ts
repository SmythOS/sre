import { encode, encodeChat } from 'gpt-tokenizer';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { ChatMessage } from 'gpt-tokenizer/esm/GptEncoding';

// TODO [Forhad]: we can move methods to MessageProcessor

//content, name, role, tool_call_id, tool_calls, function_call
export class LLMContext {
    private _systemPrompt: string = '';
    public get systemPrompt() {
        return this._systemPrompt;
    }
    public set systemPrompt(systemPrompt) {
        this._systemPrompt = systemPrompt;
    }
    private _llmHelper: LLMHelper;
    public contextLength: number;
    public get llmHelper() {
        return this._llmHelper;
    }

    public get messages() {
        return this._messages;
    }
    /**
     *
     * @param source a messages[] object, or smyth file system uri (smythfs://...)
     */
    constructor(private _model, _systemPrompt: string = '', private _messages: any[] = []) {
        this._systemPrompt = _systemPrompt;
        //TODO:allow configuring a storage service
        this._llmHelper = new LLMHelper();
    }

    public push(...message: any[]) {
        this._messages.push(...message);

        //TODO: persist to storage
    }
    public addUserMessage(content: string) {
        this.push({ role: 'user', content });
    }
    public addAssistantMessage(content: string) {
        this.push({ role: 'assistant', content });
    }

    public async getContextWindow(maxTokens: number, maxOutputTokens: number = 256): Promise<any[]> {
        //TODO: handle non key accounts (limit tokens)
        // const maxModelContext = this._llmHelper?.modelInfo?.keyOptions?.tokens || this._llmHelper?.modelInfo?.tokens || 256;
        const maxModelContext = await this._llmHelper.TokenManager().getAllowedContextTokens(this._model, true);
        let maxInputContext = Math.min(maxTokens, maxModelContext);

        if (maxInputContext + maxOutputTokens > maxModelContext) {
            maxInputContext -= maxInputContext + maxOutputTokens - maxModelContext;
        }

        let messages = [];

        const systemMessage = { role: 'system', content: this._systemPrompt };
        //loop through messages from last to first and use encodeChat to calculate token lengths

        let tokens = encodeChat([systemMessage as ChatMessage], 'gpt-4o').length;
        for (let i = this._messages.length - 1; i >= 0; i--) {
            const message = this._messages[i] as ChatMessage;

            //skip system messages because we will add our own

            if (message.role === 'system') continue;

            //skip empty messages
            if (!message.content) {
                //FIXME: tool call messages does not have a content but have a tool field do we need to count them as tokens ?
                messages.unshift(message);
                continue;
            }

            delete message['__smyth_data__']; //remove smyth data entry, this entry may hold smythOS specific data

            const textContent = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
            const encoded = encode(textContent);
            tokens += encoded.length;
            if (tokens > maxInputContext) {
                if (typeof message.content !== 'string') {
                    //FIXME: handle this case for object contents (used by Anthropic for tool calls for example)
                    break;
                }
                //handle context window overflow
                //FIXME: the logic here is weak, we need a better one
                const diff = tokens - maxInputContext;
                const excessPercentage = diff / encoded.length;

                //truncate message content
                //const textContent = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);

                message.content = message.content.slice(0, Math.floor(message.content.length * (1 - excessPercentage)) - 200);
                message.content += '...\n\nWARNING : The context window has been truncated to fit the maximum token limit.';

                tokens -= encoded.length;
                tokens += encodeChat([message], 'gpt-4').length;
                //break;
            }
            messages.unshift(message);
        }
        //add system message as first message in the context window
        messages.unshift(systemMessage);

        return messages;
    }
}
