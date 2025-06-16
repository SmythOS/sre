import { Connector } from '@sre/Core/Connector.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
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
    ILLMRequestFuncParams,
    TLLMChatResponse,
    TLLMRequestBody,
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
    // chatRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<any>;
    // visionRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<any>;
    // multimodalRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<any>;
    // toolRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<any>;

    request(params: TLLMConnectorParams): Promise<TLLMChatResponse>;
    streamRequest(params: TLLMConnectorParams): Promise<EventEmitter>;

    imageGenRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<any>;
    imageEditRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<any>;
}

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

    protected abstract request({ acRequest, body, context }: ILLMRequestFuncParams): Promise<TLLMChatResponse>;
    protected abstract streamRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter>;
    protected abstract webSearchRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter>;

    protected abstract reqBodyAdapter(params: TLLMConnectorParams): Promise<TLLMRequestBody>;
    protected abstract reportUsage(usage: any, metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }): any;

    // Optional method - default implementation throws error. (It's a workaround. We will move image related methods to another subsystem.)
    protected imageGenRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<any> {
        return Promise.reject(new Error('Image edit not supported by this model'));
    }
    protected imageEditRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<any> {
        return Promise.reject(new Error('Image edit not supported by this model'));
    }

    private vaultConnector: VaultConnector;

    public requester(candidate: AccessCandidate): ILLMConnectorRequest {
        //if (candidate.role !== 'agent') throw new Error('Only agents can use LLM connector');

        this.vaultConnector = ConnectorService.getVaultConnector();

        if (!this.vaultConnector || !this.vaultConnector.valid) {
            console.warn(`Vault Connector unavailable for ${candidate.id} `);
        }

        const _request: ILLMConnectorRequest = {
            request: async (params: TLLMConnectorParams) => {
                const preparedParams = await this.prepareParams(candidate, params);

                const response = await this.request({
                    acRequest: candidate.readRequest,
                    body: preparedParams.body,
                    context: {
                        modelEntryName: preparedParams.modelEntryName,
                        agentId: preparedParams.agentId,
                        teamId: preparedParams.teamId,
                        isUserKey: preparedParams.isUserKey,
                        hasFiles: preparedParams.files?.length > 0,
                        modelInfo: preparedParams.modelInfo,
                        credentials: preparedParams.credentials,
                    },
                });

                return response;
            },
            streamRequest: async (params: TLLMConnectorParams) => {
                const preparedParams = await this.prepareParams(candidate, params);

                const requestParams = {
                    acRequest: candidate.readRequest,
                    body: preparedParams.body,
                    context: {
                        modelEntryName: preparedParams.modelEntryName,
                        agentId: preparedParams.agentId,
                        teamId: preparedParams.teamId,
                        isUserKey: preparedParams.isUserKey,
                        hasFiles: preparedParams.files?.length > 0,
                        modelInfo: preparedParams.modelInfo,
                        credentials: preparedParams.credentials,
                    },
                };

                let response;

                if (preparedParams.capabilities?.search === true && preparedParams.useWebSearch === true) {
                    response = await this.webSearchRequest(requestParams);
                } else {
                    response = await this.streamRequest(requestParams);
                }

                return response;
            },

            imageGenRequest: async (params: any) => {
                const preparedParams = await this.prepareParams(candidate, params);

                const response = await this.imageGenRequest({
                    acRequest: candidate.readRequest,
                    body: preparedParams.body,
                    context: {
                        modelEntryName: preparedParams.modelEntryName,
                        isUserKey: preparedParams.isUserKey,
                        agentId: preparedParams.agentId,
                        teamId: preparedParams.teamId,
                        hasFiles: preparedParams.files?.length > 0,
                        modelInfo: preparedParams.modelInfo,
                        credentials: preparedParams.credentials,
                    },
                });

                return response;
            },
            imageEditRequest: async (params: any) => {
                const preparedParams = await this.prepareParams(candidate, params);

                const response = await this.imageEditRequest({
                    acRequest: candidate.readRequest,
                    body: preparedParams.body,
                    context: {
                        modelEntryName: preparedParams.modelEntryName,
                        isUserKey: preparedParams.isUserKey,
                        agentId: preparedParams.agentId,
                        teamId: preparedParams.teamId,
                        hasFiles: preparedParams.files?.length > 0,
                        modelInfo: preparedParams.modelInfo,
                        credentials: preparedParams.credentials,
                    },
                });

                return response;
            },
        };

        return _request;
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
        const credentialsList: any[] = !Array.isArray(modelInfo.credentials)
            ? [modelInfo.credentials]
            : modelInfo.credentials || [TLLMCredentials.None];

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
    private async prepareParams(candidate: AccessCandidate, params: TLLMConnectorParams): Promise<TLLMConnectorParams & { body: any }> {
        const modelsProvider: ModelsProviderConnector = ConnectorService.getModelsProviderConnector();
        // Assign file from the original parameters to avoid overwriting the original constructor
        const files = params?.files;
        delete params?.files; // need to remove files to avoid any issues during JSON.stringify() especially when we have large files

        const clonedParams = JSON.parse(JSON.stringify(params)); // Avoid mutation of the original params

        // Format the parameters to ensure proper type of values
        const _params: TLLMConnectorParams = this.formatParamValues(clonedParams);

        const model = _params.model;
        const teamId = await this.getTeamId(candidate);

        // We need the model entry name for usage reporting
        _params.modelEntryName = typeof model === 'string' ? model : (model as TLLMModel).modelId;
        _params.teamId = teamId;

        const modelProviderCandidate = modelsProvider.requester(candidate);
        const modelInfo: TLLMModel | TCustomLLMModel = await modelProviderCandidate.getModelInfo(model);

        //if the model has default params make sure to set them if they are not present
        if (modelInfo.params) {
            for (let key in modelInfo.params) {
                if (typeof _params[key] === 'undefined') {
                    _params[key] = modelInfo.params[key];
                }
            }
        }

        const isStandardLLM = await modelProviderCandidate.isStandardLLM(model);

        const llmProvider = await modelProviderCandidate.getProvider(model);

        _params.credentials = await this.getCredentials(candidate, modelInfo);

        //_params.model = (await modelProviderCandidate.getModelId(model)) || model;

        _params.baseURL = modelInfo?.baseURL;
        if (!isStandardLLM) _params.modelInfo = modelInfo as TCustomLLMModel; //only if custom LLM ?

        if (_params.maxTokens) {
            _params.maxTokens = await modelProviderCandidate.adjustMaxCompletionTokens(model, _params.maxTokens, _params?.isUserKey as boolean);
        } else {
            // max output tokens is mandatory for Anthropic models
            // We provide the default max output tokens here to avoid some complexity in reqBodyAdapter()
            _params.maxTokens = await modelProviderCandidate.getMaxCompletionTokens(model, _params?.isUserKey as boolean);
        }

        _params.model = await modelProviderCandidate.getModelId(model);
        // Attach the files again after formatting the parameters
        _params.files = files;

        const features = modelInfo?.features || [];

        _params.capabilities = {
            search: features.includes('search'),
            reasoning: features.includes('reasoning'),
            imageGeneration: features.includes('image-generation'),
        };

        // The input adapter transforms the standardized parameters into the specific format required by the target LLM provider
        _params.agentId = candidate.id;
        const body = await this.reqBodyAdapter(_params);

        return { ..._params, body };
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
        modelInfo: TCustomLLMModel
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
