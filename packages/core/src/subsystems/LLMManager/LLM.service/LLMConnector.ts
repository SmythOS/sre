import Agent from '@sre/AgentManager/Agent.class';
import { Connector } from '@sre/Core/Connector.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { TLLMParams, TLLMMessageBlock, TLLMToolResultMessageBlock, ToolData, TLLMProvider, APIKeySource } from '@sre/types/LLM.types';
import EventEmitter from 'events';
import { Readable } from 'stream';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
import { CustomLLMRegistry } from '@sre/LLMManager/CustomLLMRegistry.class';
import { VaultConnector } from '@sre/Security/Vault.service/VaultConnector';
import { TBedrockModel, TVertexAIModel } from '@sre/types/LLM.types';
import config from '@sre/config';

const console = Logger('LLMConnector');

export interface ILLMConnectorRequest {
    chatRequest(params: any): Promise<any>;
    visionRequest(prompt, params: any): Promise<any>;
    multimodalRequest(prompt, params: any): Promise<any>;
    toolRequest(params: any): Promise<any>;
    streamToolRequest(params: any): Promise<any>;
    streamRequest(params: any): Promise<EventEmitter>;
    multimodalStreamRequest(prompt, params: any): Promise<any>;
    imageGenRequest(prompt, params: any): Promise<any>;
}

export type LLMChatResponse = {
    content: string;
    finishReason: string;
};

export type ImagesResponse = {
    created: number;
    data: Array<{
        b64_json?: string;
        url?: string;
    }>;
};

const SMYTHOS_API_KEYS = {
    openai: config.env.OPENAI_API_KEY,
    anthropic: config.env.ANTHROPIC_API_KEY,
    googleai: config.env.GOOGLE_AI_API_KEY,
    togetherai: config.env.TOGETHER_AI_API_KEY,
    groq: config.env.GROQ_API_KEY,
    xai: config.env.XAI_API_KEY,
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
    protected abstract chatRequest(acRequest: AccessRequest, params: any, agent: string | Agent): Promise<LLMChatResponse>;
    protected abstract visionRequest(acRequest: AccessRequest, prompt, params: any, agent: string | Agent): Promise<LLMChatResponse>;
    protected abstract multimodalRequest(acRequest: AccessRequest, prompt, params: any, agent: string | Agent): Promise<LLMChatResponse>;
    protected abstract toolRequest(acRequest: AccessRequest, params: any, agent: string | Agent): Promise<any>;
    protected abstract streamToolRequest(acRequest: AccessRequest, params: any, agent: string | Agent): Promise<any>;
    protected abstract streamRequest(acRequest: AccessRequest, params: any, agent: string | Agent): Promise<EventEmitter>;
    protected abstract multimodalStreamRequest(acRequest: AccessRequest, prompt, params: any, agent: string | Agent): Promise<EventEmitter>;
    protected abstract imageGenRequest(acRequest: AccessRequest, prompt, params: any, agent: string | Agent): Promise<ImagesResponse>;
    protected abstract reportUsage(usage: any, metadata: { model: string; modelEntryName: string; keySource: APIKeySource; agentId: string }): void;

    private vaultConnector: VaultConnector;

    public user(candidate: AccessCandidate): ILLMConnectorRequest {
        if (candidate.role !== 'agent') throw new Error('Only agents can use LLM connector');

        this.vaultConnector = ConnectorService.getVaultConnector();

        if (!this.vaultConnector) throw new Error('Vault Connector unavailable, cannot proceed');

        return {
            chatRequest: async (params: any) => {
                const _params: TLLMParams = await this.prepareParams(candidate, params);

                return this.chatRequest(candidate.readRequest, _params, candidate.id);
            },
            visionRequest: async (prompt, params: any) => {
                const _params: TLLMParams = await this.prepareParams(candidate, params);

                return this.visionRequest(candidate.readRequest, prompt, _params, candidate.id);
            },
            multimodalRequest: async (prompt, params: any) => {
                const _params: TLLMParams = await this.prepareParams(candidate, params);

                return this.multimodalRequest(candidate.readRequest, prompt, _params, candidate.id);
            },
            imageGenRequest: async (prompt, params: any) => {
                const _params: TLLMParams = await this.prepareParams(candidate, params);

                return this.imageGenRequest(candidate.readRequest, prompt, _params, candidate.id);
            },
            toolRequest: async (params: any) => {
                const _params: TLLMParams = await this.prepareParams(candidate, params);

                return this.toolRequest(candidate.readRequest, _params, candidate.id);
            },
            streamToolRequest: async (params: any) => {
                const _params: TLLMParams = await this.prepareParams(candidate, params);

                return this.streamToolRequest(candidate.readRequest, _params, candidate.id);
            },
            streamRequest: async (params: any) => {
                const _params: TLLMParams = await this.prepareParams(candidate, params);

                return this.streamRequest(candidate.readRequest, _params, candidate.id);
            },
            multimodalStreamRequest: async (prompt, params: any) => {
                const _params: TLLMParams = await this.prepareParams(candidate, params);

                return this.multimodalStreamRequest(candidate.readRequest, prompt, _params, candidate.id);
            },
        };
    }

    public enhancePrompt(prompt: string, config: any) {
        if (!prompt) return prompt;
        let newPrompt = prompt;
        const outputs = {};

        if (config?.outputs) {
            for (let con of config.outputs) {
                if (con.default) continue;
                outputs[con.name] = con?.description ? `<${con?.description}>` : '';
            }
        }

        const excludedKeys = ['_debug', '_error'];
        const outputKeys = Object.keys(outputs).filter((key) => !excludedKeys.includes(key));

        if (outputKeys.length > 0) {
            const outputFormat = {};
            outputKeys.forEach((key) => (outputFormat[key] = config.name === 'Classifier' ? '<Boolean|String>' : '<value>'));

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

    public async prepareParams(candidate: AccessCandidate, params: any) {
        // Assign fileSource from the original parameters to avoid overwriting the original constructor
        const fileSources = params?.fileSources;
        delete params?.fileSources; // need to remove fileSources to avoid any issues during JSON.stringify() especially when we have large files

        const clonedParams = JSON.parse(JSON.stringify(params)); // Avoid mutation of the original params

        // Format the parameters to ensure proper type of values
        const _params = this.formatParamValues(clonedParams);

        const model = _params.model;
        const teamId = await this.getTeamId(candidate);

        // We need the model entry name for usage reporting
        _params.modelEntryName = model;
        _params.teamId = teamId;

        const isStandardLLM = LLMRegistry.isStandardLLM(model);

        if (isStandardLLM) {
            const llmProvider = LLMRegistry.getProvider(model);

            if (LLMRegistry.isSmythOSModel(model)) {
                _params.credentials = {
                    apiKey: SMYTHOS_API_KEYS?.[llmProvider] || '',
                };
            } else {
                _params.credentials = await this.getStandardLLMCredentials(candidate, llmProvider);

                // we provide the api key for OpenAI models to support existing components
                if (!_params.credentials?.apiKey && llmProvider?.toLowerCase() === 'openai') {
                    _params.credentials.apiKey = SMYTHOS_API_KEYS.openai;
                } else {
                    _params.credentials.isUserKey = true;
                }
            }

            if (_params.maxTokens) {
                _params.maxTokens = LLMRegistry.adjustMaxCompletionTokens(_params.model, _params.maxTokens, !!_params?.credentials?.apiKey);
            }

            const baseUrl = LLMRegistry.getBaseURL(params.model);

            if (baseUrl) {
                _params.baseURL = baseUrl;
            }

            _params.model = LLMRegistry.getModelId(model) || model;
        } else {
            const customLLMRegistry = await CustomLLMRegistry.getInstance(teamId);

            const modelInfo = customLLMRegistry.getModelInfo(model);

            _params.modelInfo = modelInfo;

            const llmProvider = customLLMRegistry.getProvider(model);

            if (llmProvider === TLLMProvider.Bedrock) {
                _params.credentials = await this.getBedrockCredentials(candidate, modelInfo as TBedrockModel);
            } else if (llmProvider === TLLMProvider.VertexAI) {
                _params.credentials = await this.getVertexAICredentials(candidate, modelInfo as TVertexAIModel);
            }

            if (_params.maxTokens) {
                _params.maxTokens = customLLMRegistry.adjustMaxCompletionTokens(model, _params.maxTokens);
            }

            _params.model = customLLMRegistry.getModelId(model) || model;
        }

        // Attach the fileSources again after formatting the parameters
        _params.fileSources = fileSources;

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

            if (key === 'messages') {
                _value = this.getConsistentMessages(_value);
            }

            _params[key] = _value;
        }

        return _params;
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
    private async getStandardLLMCredentials(candidate: AccessCandidate, provider: string): Promise<{ apiKey: string }> {
        const apiKey = await this.vaultConnector
            .user(candidate)
            .get(provider)
            .catch(() => '');

        return { apiKey };
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
        modelInfo: TBedrockModel
    ): Promise<{ accessKeyId: string; secretAccessKey: string; sessionToken?: string }> {
        const keyIdName = modelInfo.settings?.keyIDName;
        const secretKeyName = modelInfo.settings?.secretKeyName;
        const sessionKeyName = modelInfo.settings?.sessionKeyName;

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
        } = {
            accessKeyId,
            secretAccessKey,
        };

        if (sessionToken) {
            credentials.sessionToken = sessionToken;
        }

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
    private async getVertexAICredentials(candidate: AccessCandidate, modelInfo: TVertexAIModel): Promise<Record<string, string>> {
        const jsonCredentialsName = modelInfo.settings?.jsonCredentialsName;

        let jsonCredentials = await this.vaultConnector
            .user(candidate)
            .get(jsonCredentialsName)
            .catch(() => '');

        const credentials = JSON.parse(jsonCredentials);

        return credentials;
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
