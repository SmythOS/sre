import {
    ILLMConnectorRequest,
    LLMConnector,
    ConnectorService,
    AccessCandidate,
    TCustomLLMModel,
    TLLMConnectorParams,
    TLLMModel,
    TLLMProvider,
    DEFAULT_TEAM_ID,
    BinaryInput,
    SRE,
} from '@smythos/sre';
import { EventEmitter } from 'events';
import { Chat } from './Chat.class';
import { SDKObject } from '../Core/SDKObject.class';
import { adaptModelParams } from './utils';
import { isFile, uid } from '../utils/general.utils';
import { ChatOptions } from '../types/SDKTypes';
import { findClosestModelInfo } from './Model';
import * as fs from 'fs';

export type TLLMCommandOptions = {
    /**
     * Used to describe the LLM behavior, this will be typically used as LLM system message.
     */
    behavior?: string;

    /**
     * List of files paths or urls to be processed by the LLM.
     */
    files?: string[];
};

class LLMCommand {
    constructor(private _llm: LLMInstance, private _params: any, private _options?: TLLMCommandOptions) {}

    /**
     * Run the command and return the result as a promise.
     * @param resolve - The function to call when the command is resolved
     * @param reject - The function to call when the command is rejected
     * @returns a promise that resolves to the result of the command
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
                        return binaryInput;
                    } else {
                        return BinaryInput.from(file);
                    }
                })
            );
        }
        return files.length > 0 ? files : undefined;
    }

    async run(): Promise<string> {
        await this._llm.ready;

        let files = await this.getFiles();
        const params = { ...this._params, ...this._llm.modelSettings, files }; // update model settings

        const result = await this._llm.requester.request(params as TLLMConnectorParams);

        if (result.finishReason !== 'stop' && result.finishReason !== 'end_turn') {
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
        const files = await this.getFiles();
        const params = { ...this._params, ...this._llm.modelSettings, files }; // update model settings

        return await this._llm.requester.streamRequest(params as TLLMConnectorParams);
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

    /** The dimensions parameter for text embeddings models */
    dimensions?: number;

    /** the maximum input tokens that the model should accept (Context window size) */
    inputTokens?: number;

    /** the maximum output tokens that the model should generate */
    outputTokens?: number;

    /** The behavior of the model, this will be typically used as LLM system message. */
    behavior?: string;

    [key: string]: any;
};

/**
 * Represents a LLM instance. These instances are created by the LLM Factory ({@link LLM}).
 *
 *
 * @example Usage example
 * ```typescript
 * const llm = LLM.OpenAI({ model: 'gpt-4o' });
 * //the above is equivalent to:
 * const llm = new LLMInstance(TLLMProvider.OpenAI, { model: 'gpt-4o' });
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
export class LLMInstance extends SDKObject {
    private _llmRequester: ILLMConnectorRequest;
    public get modelSettings() {
        return this._modelSettings;
    }

    public get requester() {
        return this._llmRequester;
    }

    constructor(private _providerId: TLLMProvider, private _modelSettings: TLLMInstanceParams, private _candidate?: AccessCandidate) {
        super();
    }

    protected async init() {
        //false means we don't resolve the ready promise
        //we will resolve it later in the init method
        await super.init(false);
        // const llmConnector = ConnectorService.getLLMConnector(this._providerId);
        // this._candidate = this._candidate || AccessCandidate.team(DEFAULT_TEAM_ID);
        // this._llmRequester = llmConnector.user(this._candidate);
        // this._modelSettings = adaptModelParams(this._modelSettings, this._providerId, this._candidate);

        this._candidate = this._candidate || AccessCandidate.team(DEFAULT_TEAM_ID);

        const modelsProvider = ConnectorService.getModelsProviderConnector();
        const modelsProviderReq = modelsProvider.requester(this._candidate);

        const models = await modelsProviderReq.getModels();

        const model = this._modelSettings;

        const builtInModelInfo = findClosestModelInfo(models, model.modelId || model.model);

        const llmConnector = ConnectorService.getLLMConnector(this._providerId);
        this._llmRequester = llmConnector.user(this._candidate);
        this._modelSettings = adaptModelParams(this._modelSettings, this._providerId, builtInModelInfo);

        this.initSignal(); //resolve the ready promise
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
    public prompt(prompt: string, options?: TLLMCommandOptions): LLMCommand {
        const messages = [];
        const behavior = options?.behavior || this._modelSettings?.behavior;
        if (behavior) {
            messages.push({ role: 'system', content: behavior });
        }
        messages.push({ role: 'user', content: prompt });
        return new LLMCommand(this, { ...this._modelSettings, messages }, options);
    }

    public chat(options?: ChatOptions | string) {
        const model = this._modelSettings.model;

        if (typeof options === 'string') {
            options = { id: options, persist: true };
        }

        const chatOptions = {
            ...options,
            candidate: this._candidate,
        };

        if (!chatOptions.model) {
            chatOptions.model = model;
        }
        return new Chat(chatOptions, undefined, {
            baseUrl: chatOptions.baseUrl,
        });
    }
}
