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
import { Chat } from './Chat.class';
import { SDKObject } from './SDKObject.class';

export function adaptModelParams(modelSettings: TLLMInstanceParams, fallbackProvider?: TLLMProvider): TLLMInstanceParams {
    const { model, provider, ...params } = modelSettings;
    const modelObject: any = {
        provider: provider || fallbackProvider,
        modelId: model as string,
    };

    modelObject.params = params;

    if (typeof modelObject?.params?.apiKey === 'string') {
        //all keys are handled in credentials object internally
        modelObject.credentials = { apiKey: modelObject?.params?.apiKey } as any;
        delete modelObject?.params?.apiKey;
    }

    if (!modelObject.credentials) {
        modelObject.credentials = ['vault'] as any;
    }

    return { model: modelObject };
}

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

/**
 * Model factory functions for each LLM provider.
 *
 * **Supported calling patterns:**
 * - `Model.provider(modelId, modelParams)` - specify model ID and optional parameters
 * - `Model.provider(modelParams)` - specify model ID within modelParams object
 *
 * @example
 * ```typescript
 * // Pattern 1: Explicit model ID
 * const model1 = Model.openai('gpt-4', { temperature: 0.7 });
 *
 * // Pattern 2: Model ID in params
 * const model2 = Model.openai({ model: 'gpt-4', temperature: 0.7 });
 * ```
 */
export type TModelFactory = {
    /**
     * Create a model with explicit model ID and optional parameters.
     *
     * @param modelId - The model identifier (e.g., `'gpt-4'`, `'claude-3-sonnet'`)
     * @param modelParams - Optional model parameters (temperature, maxTokens, etc.)
     * @returns Configured model object
     */
    (modelId: string, modelParams?: TLLMInstanceParams): any;

    /**
     * Create a model with parameters object containing model ID.
     *
     * @param modelParams - Model parameters including the required `model` field
     * @returns Configured model object
     */
    (modelParams: TLLMInstanceParams & { model: string | TLLMModel | TCustomLLMModel }): any;
};

const Model = {} as Record<TLLMProvider, TModelFactory>;

for (const provider of Object.keys(TLLMProvider)) {
    Model[provider] = ((modelIdOrParams: string | TLLMInstanceParams, modelParams?: TLLMInstanceParams): any => {
        if (typeof modelIdOrParams === 'string') {
            // First signature: (modelId: string, modelParams?: TLLMInstanceParams)
            return adaptModelParams({ model: modelIdOrParams, ...modelParams }, TLLMProvider[provider]).model;
        } else {
            // Second signature: (modelParams: TLLMInstanceParams)
            return adaptModelParams(modelIdOrParams, TLLMProvider[provider]).model;
        }
    }) as TModelFactory;
}

/**
 * LLM instance factory functions for each LLM provider.
 *
 * **Supported calling patterns:**
 * - `LLM.provider(modelId, modelParams)` - specify model ID and optional parameters
 * - `LLM.provider(modelParams)` - specify model ID within modelParams object
 *
 * @example
 * ```typescript
 * // Pattern 1: Explicit model ID
 * const llm1 = LLM.openai('gpt-4', { temperature: 0.7 });
 * const response1 = await llm1.prompt("Hello!");
 *
 * // Pattern 2: Model ID in params
 * const llm2 = LLM.openai({ model: 'gpt-4', temperature: 0.7 });
 * const response2 = await llm2.prompt("Hello!");
 * ```
 */
export type TLLMInstanceFactory = {
    /**
     * Create an LLM instance with explicit model ID and optional parameters.
     *
     * @param modelId - The model identifier (e.g., `'gpt-4'`, `'claude-3-sonnet'`)
     * @param modelParams - Optional model parameters (temperature, maxTokens, etc.)
     * @returns LLM instance ready for use
     */
    (modelId: string, modelParams?: TLLMInstanceParams): LLMInstance;

    /**
     * Create an LLM instance with parameters object containing model ID.
     *
     * @param modelParams - Model parameters including the required `model` field
     * @returns LLM instance ready for use
     */
    (modelParams: TLLMInstanceParams & { model: string | TLLMModel | TCustomLLMModel }): LLMInstance;
};

export type TLLMProviderInstances = {
    [key in TLLMProvider]: TLLMInstanceFactory;
};

const LLM: TLLMProviderInstances = {} as TLLMProviderInstances;
for (const provider of Object.keys(TLLMProvider)) {
    LLM[provider] = ((modelIdOrParams: string | TLLMInstanceParams, modelParams?: TLLMInstanceParams): LLMInstance => {
        if (typeof modelIdOrParams === 'string') {
            // First signature: (modelId: string, modelParams?: TLLMInstanceParams)
            return new LLMInstance(TLLMProvider[provider], { model: modelIdOrParams, ...modelParams });
        } else {
            // Second signature: (modelParams: TLLMInstanceParams)
            return new LLMInstance(TLLMProvider[provider], modelIdOrParams);
        }
    }) as TLLMInstanceFactory;
}

export { LLM, Model };
