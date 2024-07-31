import { encode, encodeChat } from 'gpt-tokenizer';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { ChatMessage } from 'gpt-tokenizer/esm/GptEncoding';

//content, name, role, tool_call_id, tool_calls, function_call
export class LLMContext {
    private _llmHelper;
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
    constructor(private _model, private _systemPrompt: string = '', private _messages: any[] = []) {
        //TODO:allow configuring a storage service
        this._llmHelper = LLMHelper.load(this._model);
    }

    public push(...message: any[]) {
        this._messages.push(...message);

        //TODO: persist to storage
    }
    public addUserMessage(content: string) {
        this.push({ role: 'user', content });
    }

    public getContextWindow(maxTokens: number, maxOutputTokens: number = 256): any[] {
        //TODO: handle non key accounts (limit tokens)
        const maxModelContext = this._llmHelper?.modelInfo?.keyOptions?.tokens || this._llmHelper?.modelInfo?.tokens || 256;
        let maxInputContext = Math.min(maxTokens, maxModelContext);

        if (maxInputContext + maxOutputTokens > maxModelContext) {
            maxInputContext -= maxInputContext + maxOutputTokens - maxModelContext;
        }

        const messages = [];

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

            // The response message from Anthropic AI contains an array within the content for the 'assistant' role. This array causes errors, so it needs to be stringified.
            if (message?.content && typeof message?.content === 'object') message.content = JSON.stringify(message.content);

            const encoded = encodeChat([message], 'gpt-4');
            tokens += encoded.length;
            if (tokens > maxInputContext) {
                //handle context window overflow
                //FIXME: the logic here is weak, we need a better one
                const diff = tokens - maxInputContext;
                const excessPercentage = diff / encoded.length;

                //truncate message content
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
