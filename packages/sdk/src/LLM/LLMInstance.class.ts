import {
    ILLMConnectorRequest,
    LLMChatResponse,
    LLMConnector,
    ConnectorService,
    AccessCandidate,
    TCustomLLMModel,
    TLLMConnectorParams,
    TLLMModel,
    TLLMProvider,
    DEFAULT_TEAM_ID,
} from '@smythos/sre';
import { EventEmitter } from 'events';
import { Chat } from '../Chat.class';
import { SDKObject } from '../SDKObject.class';
import { adaptModelParams } from './utils';

class LLMCommand {
    constructor(private _llm: LLMInstance, private _params: any) {}

    /**
     * Run the command and return the result as a promise.
     * @param resolve - The function to call when the command is resolved
     * @param reject - The function to call when the command is rejected
     * @returns a promise that resolves to the result of the command
     */
    then(resolve: (value: string) => void, reject?: (reason: any) => void) {
        return this.run().then(resolve, reject);
    }

    async run(): Promise<string> {
        await this._llm.ready;

        const result = await this._llm.requester.chatRequest(this._params as TLLMConnectorParams);

        if (result.finishReason !== 'stop') {
            this._llm.emit(
                'error',
                new Error('The model stopped before completing the response, this is usually due to output token limit reached.')
            );
        }
        return result?.content ?? '';
    }

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
    async stream(): Promise<EventEmitter> {
        await this._llm.ready;

        return await this._llm.requester.streamRequest(this._params as TLLMConnectorParams);
    }

    // Future extensibility:
    // async batch(): Promise<string[]>
    // temperature(temp: number): PromptBuilder : override the modelParams
    // maxTokens(maxTokens: number): PromptBuilder : override the modelParams
    // ...
    // params(...): PromptBuilder : override the modelParams

    // temperature(temp: number): LLMCommand {
    //     this.llm.modelParams.temperature = temp;
    //     return this;
    // }
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
};

export class LLMInstance extends SDKObject {
    private _llmRequester: ILLMConnectorRequest;

    public get requester() {
        return this._llmRequester;
    }

    constructor(private _providerId: TLLMProvider, private _modelSettings: TLLMInstanceParams, private _candidate?: AccessCandidate) {
        super();
    }

    protected async init() {
        await super.init();
        const llmConnector = ConnectorService.getLLMConnector(this._providerId);
        this._candidate = this._candidate || AccessCandidate.team(DEFAULT_TEAM_ID);
        this._llmRequester = llmConnector.user(this._candidate);
        this._modelSettings = adaptModelParams(this._modelSettings, this._providerId);
    }

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
    public prompt(prompt: string): LLMCommand {
        return new LLMCommand(this, { ...this._modelSettings, messages: [{ role: 'user', content: prompt }] });
    }

    public chat() {
        const model = this._modelSettings.model;

        //const modelName = typeof model === 'string' ? model : (model as TLLMModel).modelId;
        return new Chat(model);
    }
}
