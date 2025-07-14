import { AccessCandidate, TCustomLLMModel, TLLMModel, TLLMProvider } from '@smythos/sre';
import { EventEmitter } from 'events';
import { Chat } from './Chat.class';
import { SDKObject } from '../Core/SDKObject.class';
import { ChatOptions } from '../types/SDKTypes';
declare class LLMCommand {
    private _llm;
    private _params;
    private _options?;
    constructor(_llm: LLMInstance, _params: any, _options?: any);
    /**
     * Run the command and return the result as a promise.
     * @param resolve - The function to call when the command is resolved
     * @param reject - The function to call when the command is rejected
     * @returns a promise that resolves to the result of the command
     */
    then(resolve: (value: string) => void, reject?: (reason: any) => void): Promise<void>;
    private getFiles;
    run(): Promise<string>;
    /**
     * Stream the response from the model as an EventEmitter.
     *
     * **Available Events: are declared in LLMEvent type**
     *
     * - LLMEvent.Content ('content') - Text chunk received from the model
     * - LLMEvent.End ('end') - The model has finished sending data
     * - LLMEvent.Error ('error') - The model encountered an error
     * - ... (see LLMEvent type for more events)
     *
     *
     * @example
     * ```typescript
     * const stream = await llmCommand.stream();
     * stream.on(LLMEvent.Content, (chunk) => console.log(chunk));
     * stream.on(LLMEvent.End, () => console.log('Stream ended'));
     * stream.on(LLMEvent.Error, (err) => console.error(err));
     * ```
     */
    stream(): Promise<EventEmitter>;
}
export type TLLMInstanceParams = {
    model?: string | TLLMModel | TCustomLLMModel;
    apiKey?: string;
    provider?: TLLMProvider;
    /** The maximum number of tokens to generate */
    maxTokens?: number;
    /** The maximum number of tokens to think */
    maxThinkingTokens?: number;
    /** The temperature of the model */
    temperature?: number;
    /** The stop sequences of the model */
    stopSequences?: string[];
    /** The top P of the model */
    topP?: number;
    /** The top K of the model */
    topK?: number;
    /** The frequency penalty of the model */
    frequencyPenalty?: number;
    /** The presence penalty of the model */
    presencePenalty?: number;
    /** The dimensions parameter for text embeddings models */
    dimensions?: number;
    [key: string]: any;
};
/**
 * Represents a LLM instance. These instances are created by the LLM Factory ({@link LLM}).
 *
 *
 * @example Usage example
 * ```typescript
 * const llm = LLM.OpenRouter({ model: 'gpt-4o' });
 * //the above is equivalent to:
 * const llm = new LLMInstance(TLLMProvider.OpenRouter, { model: 'gpt-4o' });
 *
 * //then you can prompt the LLM to get the response in one shot
 * const response = await llm.prompt('Hello, world!');
 *
 * //or as a stream
 * const stream = await llm.prompt('Hello, world!').stream();
 * stream.on('data', (chunk) => console.log(chunk));
 * stream.on('end', () => console.log('Stream ended'));
 * stream.on('error', (err) => console.error(err));
 *
 * //or as a chat (@see )
 * const chat = llm.chat();
 * chat.prompt('Hello, world!');
 *
 * ```
 * More examples are available in the **{@link LLM}** namespace.
 */
export declare class LLMInstance extends SDKObject {
    private _providerId;
    private _modelSettings;
    private _candidate?;
    private _llmRequester;
    get modelSettings(): TLLMInstanceParams;
    get requester(): ILLMConnectorRequest;
    constructor(_providerId: TLLMProvider, _modelSettings: TLLMInstanceParams, _candidate?: AccessCandidate);
    protected init(): Promise<void>;
    /**
     * Query the LLM with a prompt.
     *
     * The returned command can be executed in two ways:
     * - **Promise mode**: returns the final result as a string
     * - **Streaming mode**: returns a stream event emitter
     *
     *
     * @example
     * ```typescript
     * // Promise mode : returns the final result as a string
     * const response = await llm.prompt("Hello, world!");
     *
     * // Streaming mode : returns an EventEmitter
     * const stream = await llm.prompt("Tell me a story").stream();
     * stream.on('data', chunk => process.stdout.write(chunk));
     * ```
     */
    prompt(prompt: string, options?: any): LLMCommand;
    chat(options?: ChatOptions | string): Chat;
}
export {};
