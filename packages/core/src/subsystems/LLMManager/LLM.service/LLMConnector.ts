import { type OpenAI } from 'openai';
import { Agent } from '@sre/AgentManager/Agent.class';
import { Connector } from '@sre/Core/Connector.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { JSONContent } from '@sre/helpers/JsonContent.helper';
import {
    TLLMParams,
    TLLMConnectorParams,
    TLLMMessageBlock,
    TLLMToolResultMessageBlock,
    ToolData,
    APIKeySource,
    TLLMModel,
    TLLMCredentials,
    TBedrockSettings,
    TVertexAISettings,
} from '@sre/types/LLM.types';
import EventEmitter from 'events';
import { Readable } from 'stream';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { VaultConnector } from '@sre/Security/Vault.service/VaultConnector';
import { TCustomLLMModel } from '@sre/types/LLM.types';
import config from '@sre/config';
import { ModelsProviderConnector } from '@sre/LLMManager/ModelsProvider.service/ModelsProviderConnector';

const console = Logger('LLMConnector');

export interface ILLMConnectorRequest {
    chatRequest(params: TLLMConnectorParams): Promise<any>;
    visionRequest(prompt, params: TLLMConnectorParams): Promise<any>;
    multimodalRequest(prompt, params: TLLMConnectorParams): Promise<any>;
    toolRequest(params: TLLMConnectorParams): Promise<any>;
    streamToolRequest(params: TLLMConnectorParams): Promise<any>;
    streamRequest(params: TLLMConnectorParams): Promise<EventEmitter>;
    multimodalStreamRequest(prompt, params: TLLMConnectorParams): Promise<any>;
    imageGenRequest(prompt, params: TLLMConnectorParams): Promise<any>;
    imageEditRequest?(prompt, params: TLLMConnectorParams): Promise<any>;
}

export type LLMChatResponse = {
    content: string;
    finishReason: string;
    thinkingContent?: string;
    usage?: any;
};

const SMYTHOS_API_KEYS = {
    echo: '',
    openai: config.env.OPENAI_API_KEY,
    anthropic: config.env.ANTHROPIC_API_KEY,
    googleai: config.env.GOOGLE_AI_API_KEY,
    togetherai: config.env.TOGETHER_AI_API_KEY,
    groq: config.env.GROQ_API_KEY,
    xai: config.env.XAI_API_KEY,
    perplexity: config.env.PERPLEXITY_API_KEY,
};

export class LLMStream extends Readable {
    private dataQueue: any[];
    private toolsData: any[];
    private hasData: boolean;
    isReading: boolean;
    constructor(options?) {
        super(options);
        this.dataQueue = [];
        this.toolsData = [];
        this.isReading = true;
    }

    _read(size) {
        if (this.dataQueue.length > 0) {
            while (this.dataQueue.length > 0) {
                const chunk = this.dataQueue.shift();
                if (!this.push(chunk)) {
                    break;
                }
            }
        } else {
            this.push(null); // No more data
        }
    }

    enqueueData(data) {
        this.dataQueue.push(data);
        this.read(0); // Trigger the _read method
    }

    endStream() {
        this.isReading = false;
        this.push(null); // End the stream
    }
}

export abstract class LLMConnector extends Connector {
    public abstract name: string;
    //public abstract user(candidate: AccessCandidate): ILLMConnectorRequest;
    protected abstract chatRequest(acRequest: AccessRequest, params: TLLMConnectorParams, agent: string | Agent): Promise<LLMChatResponse>;
    protected abstract visionRequest(acRequest: AccessRequest, prompt, params: TLLMConnectorParams, agent: string | Agent): Promise<LLMChatResponse>;
    protected abstract multimodalRequest(
        acRequest: AccessRequest,
        prompt,
        params: TLLMConnectorParams,
        agent: string | Agent,
    ): Promise<LLMChatResponse>;
    protected abstract toolRequest(acRequest: AccessRequest, params: TLLMConnectorParams, agent: string | Agent): Promise<any>;
    protected abstract streamToolRequest(acRequest: AccessRequest, params: TLLMConnectorParams | any, agent: string | Agent): Promise<any>;
    protected abstract streamRequest(acRequest: AccessRequest, params: TLLMConnectorParams, agent: string | Agent): Promise<EventEmitter>;
    protected abstract multimodalStreamRequest(
        acRequest: AccessRequest,
        prompt,
        params: TLLMConnectorParams,
        agent: string | Agent,
    ): Promise<EventEmitter>;
    protected abstract reportUsage(usage: any, metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }): any;

    protected abstract imageGenRequest(acRequest: AccessRequest, prompt, params: TLLMConnectorParams, agent: string | Agent): Promise<OpenAI.ImagesResponse>;

    // Optional method - default implementation throws error. (It's a workaround. We will move image related methods to another subsystem.)
    protected imageEditRequest(acRequest: AccessRequest, prompt, params: TLLMConnectorParams, agent: string | Agent): Promise<any> {
        return Promise.reject(new Error('Image edit not supported by this model'));
    }

    private vaultConnector: VaultConnector;

    public requester(candidate: AccessCandidate): ILLMConnectorRequest {
        //if (candidate.role !== 'agent') throw new Error('Only agents can use LLM connector');

        this.vaultConnector = ConnectorService.getVaultConnector();

        if (!this.vaultConnector || !this.vaultConnector.valid) {
            console.warn(`Vault Connector unavailable for ${candidate.id} `);
        }

        const request: ILLMConnectorRequest = {
            chatRequest: async (params: any) => {
                const _params: TLLMConnectorParams = await this.prepareParams(candidate, params);

                return this.chatRequest(candidate.readRequest, _params, candidate.id);
            },
            visionRequest: async (prompt, params: any) => {
                const _params: TLLMConnectorParams = await this.prepareParams(candidate, params);

                return this.visionRequest(candidate.readRequest, prompt, _params, candidate.id);
            },
            multimodalRequest: async (prompt, params: any) => {
                const _params: TLLMConnectorParams = await this.prepareParams(candidate, params);

                return this.multimodalRequest(candidate.readRequest, prompt, _params, candidate.id);
            },
            toolRequest: async (params: any) => {
                const _params: TLLMConnectorParams = await this.prepareParams(candidate, params);

                return this.toolRequest(candidate.readRequest, _params, candidate.id);
            },
            streamToolRequest: async (params: any) => {
                const _params: TLLMConnectorParams = await this.prepareParams(candidate, params);

                return this.streamToolRequest(candidate.readRequest, _params, candidate.id);
            },
            streamRequest: async (params: any) => {
                const _params: TLLMConnectorParams = await this.prepareParams(candidate, params);

                return this.streamRequest(candidate.readRequest, _params, candidate.id);
            },
            multimodalStreamRequest: async (prompt, params: any) => {
                const _params: TLLMConnectorParams = await this.prepareParams(candidate, params);

                return this.multimodalStreamRequest(candidate.readRequest, prompt, _params, candidate.id);
            },
            imageGenRequest: async (prompt, params: any) => {
                const _params: TLLMConnectorParams = await this.prepareParams(candidate, params);

                return this.imageGenRequest(candidate.readRequest, prompt, _params, candidate.id);
            },
            imageEditRequest: async (prompt, params: any) => {
                const _params: TLLMConnectorParams = await this.prepareParams(candidate, params);

                return this.imageEditRequest(candidate.readRequest, prompt, _params, candidate.id);
            },
        };

        return request;
    }

    public enhancePrompt(prompt: string, config: any) {
        if (!prompt) return prompt;
        let newPrompt = prompt;
        const outputs = {};

        if (config?.outputs) {
            for (let con of config.outputs) {
                if (con.default) continue;
                outputs[con.name] = con?.description ? ` (${con?.description})` : '';
            }
        }

        const excludedKeys = ['_debug', '_error'];
        const outputKeys = Object.keys(outputs).filter((key) => !excludedKeys.includes(key));

        if (outputKeys.length > 0) {
            const outputFormat = {};
            outputKeys.forEach((key) => (outputFormat[key] = (config.name === 'Classifier' ? '<Boolean|String>' : '<value>') + (outputs[key] || '')));

            newPrompt +=
                '\n##\nExpected output format = ' +
                JSON.stringify(outputFormat) +
                '\nThe output JSON should only use the entries from the output format.';

            //console.debug(` Enhanced prompt \n`, prompt, '\n');
        }

        return newPrompt;
    }

    public postProcess(response: string) {
        try {
            return JSONContent(response).tryParse();
        } catch (error) {
            return {
                error: 'Invalid JSON response',
                data: response,
                details: 'The response from the model is not a valid JSON object. Please check the model output and try again.',
            };
        }
    }
    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto' }) {
        throw new Error('This model does not support tools');
    }

    public transformToolMessageBlocks({
        messageBlock,
        toolsData,
    }: {
        messageBlock: TLLMMessageBlock;
        toolsData: ToolData[];
    }): TLLMToolResultMessageBlock[] {
        throw new Error('This model does not support tools');
    }

    public getConsistentMessages(messages: TLLMMessageBlock[]) {
        return messages; // if a LLM connector does not implement this method, the messages will not be modified
    }

    private async getCredentials(candidate: AccessCandidate, modelInfo: TLLMModel | TCustomLLMModel) {
        //create a credentials list that we can iterate over
        //if the credentials are not provided, we will use None as a default in order to return empty credentials
        const credentialsList: any[] =
            typeof modelInfo.credentials === 'string' ? [modelInfo.credentials] : modelInfo.credentials || [TLLMCredentials.None];

        for (let credentialsMode of credentialsList) {
            if (typeof credentialsMode === 'object') {
                //credentials passed directly
                return credentialsMode;
            }

            switch (credentialsMode) {
                case TLLMCredentials.None: {
                    return { apiKey: '' };
                }
                case TLLMCredentials.Internal: {
                    const credentials = await this.getEnvCredentials(candidate, modelInfo as TLLMModel);
                    if (credentials) return credentials;
                    break;
                }
                case TLLMCredentials.Vault: {
                    const credentials = await this.getStandardLLMCredentials(candidate, modelInfo as TLLMModel);
                    if (credentials) return credentials;
                    break;
                }
                case TLLMCredentials.BedrockVault: {
                    const credentials = await this.getBedrockCredentials(candidate, modelInfo as TCustomLLMModel);
                    if (credentials) return credentials;
                    break;
                }
                case TLLMCredentials.VertexAIVault: {
                    const credentials = await this.getVertexAICredentials(candidate, modelInfo as TCustomLLMModel);
                    if (credentials) return credentials;
                    break;
                }
            }
        }

        return {};
    }
    private async prepareParams(candidate: AccessCandidate, params: TLLMConnectorParams): Promise<TLLMParams> {
        const modelsProvider: ModelsProviderConnector = ConnectorService.getModelsProviderConnector();
        // Assign fileSource from the original parameters to avoid overwriting the original constructor
        const fileSources = params?.fileSources;
        delete params?.fileSources; // need to remove fileSources to avoid any issues during JSON.stringify() especially when we have large files

        const clonedParams = JSON.parse(JSON.stringify(params)); // Avoid mutation of the original params

        // Format the parameters to ensure proper type of values
        const _params: TLLMParams = this.formatParamValues(clonedParams);

        const model = _params.model;
        const teamId = await this.getTeamId(candidate);

        // We need the model entry name for usage reporting
        _params.modelEntryName = typeof model === 'string' ? model : (model as TLLMModel).modelId;
        _params.teamId = teamId;

        const modelProviderCandidate = modelsProvider.requester(candidate);
        const modelInfo: TLLMModel | TCustomLLMModel = await modelProviderCandidate.getModelInfo(model);

        const isStandardLLM = await modelProviderCandidate.isStandardLLM(model);

        const llmProvider = await modelProviderCandidate.getProvider(model);

        _params.credentials = await this.getCredentials(candidate, modelInfo);

        //_params.model = (await modelProviderCandidate.getModelId(model)) || model;

        _params.baseURL = modelInfo?.baseURL;
        if (!isStandardLLM) _params.modelInfo = modelInfo as TCustomLLMModel; //only if custom LLM ?

        if (_params.maxTokens) {
            _params.maxTokens = await modelProviderCandidate.adjustMaxCompletionTokens(
                model,
                _params.maxTokens,
                _params?.credentials?.isUserKey as boolean,
            );
        }

        _params.model = await modelProviderCandidate.getModelId(model);
        // Attach the fileSources again after formatting the parameters
        _params.fileSources = fileSources;

        //if (isStandardLLM) {
        //const modelInfo = LLMRegistry.getModelInfo(model) as TLLMModel;

        // Provide default SmythOS API key for OpenAI models to maintain backwards compatibility with existing components that use built-in models
        // if (!_params.credentials?.apiKey && llmProvider.toLowerCase() === 'openai') {
        //     //const modelInfo = LLMRegistry.getModelInfo(model);
        //     const isImageGenerationModel = modelInfo?.features?.includes('image-generation');

        //     // We will not provide Smyth OS key for image generation models
        //     if (!isImageGenerationModel) {
        //         _params.credentials.apiKey = SMYTHOS_API_KEYS.openai;
        //     }
        // } else {
        //     _params.credentials.isUserKey = true;
        // }
        //}

        // if (_params.maxTokens) {
        //     _params.maxTokens = LLMRegistry.adjustMaxCompletionTokens(_params.model, _params.maxTokens, !!_params?.credentials?.apiKey);
        // }

        // if (_params.maxThinkingTokens) {
        //     _params.maxThinkingTokens = LLMRegistry.adjustMaxThinkingTokens(_params.maxTokens, _params.maxThinkingTokens);
        // }

        // const baseUrl = LLMRegistry.getBaseURL(params.model);

        // if (baseUrl) {
        //     _params.baseURL = baseUrl;
        // }

        //_params.model = LLMRegistry.getModelId(model) || model;
        //} else {
        //const team = AccessCandidate.team(teamId);
        //const customLLMRegistry = await CustomLLMRegistry.getInstance(team);
        //const modelInfo = customLLMRegistry.getModelInfo(model);
        //_params.modelInfo = modelInfo;
        //const llmProvider = customLLMRegistry.getProvider(model);
        // if (llmProvider === TLLMProvider.Bedrock) {
        //     _params.credentials = await this.getBedrockCredentials(candidate, modelInfo as TCustomLLMModel);
        // } else if (llmProvider === TLLMProvider.VertexAI) {
        //     _params.credentials = await this.getVertexAICredentials(candidate, modelInfo as TCustomLLMModel);
        // }
        // User key is always true for custom LLMs
        //_params.credentials.isUserKey = true;
        // if (_params.maxTokens) {
        //     _params.maxTokens = customLLMRegistry.adjustMaxCompletionTokens(model, _params.maxTokens);
        // }
        // if (_params.maxThinkingTokens) {
        //     _params.maxThinkingTokens = customLLMRegistry.adjustMaxThinkingTokens(_params.maxTokens, _params.maxThinkingTokens);
        // }
        //_params.model = customLLMRegistry.getModelId(model) || model;
        //}

        // // Attach the fileSources again after formatting the parameters
        // _params.fileSources = fileSources;

        return _params;
    }

    // TODO [Forhad]: apply proper typing for _value and return value
    private formatParamValues(params: Record<string, string | number | TLLMMessageBlock[]>): any {
        let _params = {};

        for (const [key, value] of Object.entries(params)) {
            let _value: any = value;

            // When we have stopSequences, we need to split it into an array
            if (key === 'stopSequences') {
                _value = _value ? _value?.split(',') : null;
            }

            // When we have a string that is a number, we need to convert it to a number
            if (typeof _value === 'string' && !isNaN(Number(_value))) {
                _value = +_value;
            }

            //FIXME: to revisit by Alaa-eddine
            if (key === 'messages') {
                _value = this.getConsistentMessages(_value);
            }

            _params[key] = _value;
        }

        return _params;
    }

    private async getEnvCredentials(candidate: AccessCandidate, modelInfo: TLLMModel): Promise<{ apiKey: string }> {
        const provider = (modelInfo.provider || modelInfo.llm)?.toLowerCase();
        const apiKey = SMYTHOS_API_KEYS?.[provider] || '';
        if (!apiKey) return null;
        return { apiKey };
    }

    /**
     * Retrieves API key credentials for standard LLM providers from the vault
     * @param candidate - The access candidate requesting the credentials
     * @param provider - The LLM provider name (e.g., 'openai', 'anthropic')
     * @returns Promise resolving to an object containing the provider's API key
     * @throws {Error} If vault connector is unavailable (handled in parent method)
     * @remarks Returns an empty string as API key if vault access fails
     * @private
     */
    private async getStandardLLMCredentials(candidate: AccessCandidate, modelInfo: TLLMModel): Promise<{ apiKey: string; isUserKey: boolean }> {
        const provider = (modelInfo.provider || modelInfo.llm)?.toLowerCase();
        const apiKey = await this.vaultConnector
            .user(candidate)
            .get(provider)
            .catch(() => '');

        if (!apiKey) return null;
        return { apiKey, isUserKey: true };
    }

    /**
     * Retrieves AWS Bedrock credentials from the vault for authentication
     * @param candidate - The access candidate requesting the credentials
     * @param modelInfo - The Bedrock model information containing credential key names in settings
     * @returns Promise resolving to AWS credentials object
     * @returns {Promise<Object>} credentials
     * @returns {string} credentials.accessKeyId - AWS access key ID
     * @returns {string} credentials.secretAccessKey - AWS secret access key
     * @returns {string} [credentials.sessionToken] - Optional AWS session token
     * @throws {Error} If vault connector is unavailable (handled in parent method)
     * @private
     */
    private async getBedrockCredentials(
        candidate: AccessCandidate,
        modelInfo: TCustomLLMModel,
    ): Promise<{ accessKeyId: string; secretAccessKey: string; sessionToken?: string; isUserKey: boolean }> {
        const keyIdName = (modelInfo.settings as TBedrockSettings)?.keyIDName;
        const secretKeyName = (modelInfo.settings as TBedrockSettings)?.secretKeyName;
        const sessionKeyName = (modelInfo.settings as TBedrockSettings)?.sessionKeyName;

        const [accessKeyId, secretAccessKey, sessionToken] = await Promise.all([
            this.vaultConnector
                .user(candidate)
                .get(keyIdName)
                .catch(() => ''),
            this.vaultConnector
                .user(candidate)
                .get(secretKeyName)
                .catch(() => ''),
            this.vaultConnector
                .user(candidate)
                .get(sessionKeyName)
                .catch(() => ''),
        ]);

        let credentials: {
            accessKeyId: string;
            secretAccessKey: string;
            sessionToken?: string;
            isUserKey: boolean;
        } = {
            accessKeyId,
            secretAccessKey,
            isUserKey: true,
        };

        if (sessionToken) {
            credentials.sessionToken = sessionToken;
        }

        if (!accessKeyId || !secretAccessKey) return null;
        return credentials;
    }

    /**
     * Retrieves the credentials required for VertexAI authentication from the vault
     * @param candidate - The access candidate requesting the credentials
     * @param modelInfo - The VertexAI model information containing settings
     * @returns Promise resolving to the parsed JSON credentials for VertexAI
     * @throws {Error} If vault connector is unavailable (handled in parent method)
     * @throws {Error} If JSON parsing fails or credentials are malformed
     * @remarks Returns empty credentials if vault access fails
     * @private
     */
    private async getVertexAICredentials(candidate: AccessCandidate, modelInfo: TCustomLLMModel): Promise<any> {
        const jsonCredentialsName = (modelInfo.settings as TVertexAISettings)?.jsonCredentialsName;

        let jsonCredentials = await this.vaultConnector
            .user(candidate)
            .get(jsonCredentialsName)
            .catch(() => '');

        const credentials = JSON.parse(jsonCredentials);

        if (!credentials) return null;
        return { ...credentials, isUserKey: true };
    }

    /**
     * Retrieves the team ID associated with the given access candidate
     * @param candidate - The access candidate whose team ID needs to be retrieved
     * @returns Promise<string> - The unique identifier of the team associated with the candidate
     * @throws {Error} If the Account Connector service is unavailable or cannot be accessed
     * @throws {Error} If the candidate's team cannot be retrieved
     * @private
     * @remarks This method is used internally to determine the team context for custom LLM operations
     */
    private async getTeamId(candidate: AccessCandidate): Promise<string> {
        const accountConnector: AccountConnector = ConnectorService.getAccountConnector();

        if (!accountConnector) throw new Error('Account Connector unavailable, cannot proceed');

        const teamId = await accountConnector.getCandidateTeam(candidate);

        return teamId;
    }
}
