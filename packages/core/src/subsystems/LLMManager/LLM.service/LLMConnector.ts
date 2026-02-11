import { Connector } from '@sre/Core/Connector.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { Logger } from '@sre/helpers/Log.helper';
import { ModelsProviderConnector } from '@sre/LLMManager/ModelsProvider.service/ModelsProviderConnector';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { VaultConnector } from '@sre/Security/Vault.service/VaultConnector';
import type {
    APIKeySource,
    ILLMRequestFuncParams,
    TLLMChatResponse,
    TLLMConnectorParams,
    TLLMMessageBlock,
    TLLMModel,
    TLLMPreparedParams,
    TLLMRequestBody,
    TLLMToolResultMessageBlock,
    ToolData,
    TOpenAIToolsInfo,
    TToolsInfo,
    TxAIToolsInfo,
} from '@sre/types/LLM.types';
import { TCustomLLMModel } from '@sre/types/LLM.types';
import EventEmitter from 'events';
import { Readable } from 'stream';
import { getLLMCredentials } from './LLMCredentials.helper';

const logger = Logger('LLMConnector');

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

export class LLMStream extends Readable {
    private dataQueue: any[];
    isReading: boolean;
    constructor(options?) {
        super(options);
        this.dataQueue = [];
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
            logger.warn(`Vault Connector unavailable for ${candidate.id} `);
        }

        const _request: ILLMConnectorRequest = {
            request: async (params: TLLMConnectorParams) => {
                logger.debug(`request ${this.name}`, candidate);
                const preparedParams = await this.prepareParams(candidate, params);

                const provider = preparedParams.modelInfo.provider;

                const response = await this.request({
                    acRequest: candidate.readRequest,
                    body: preparedParams.body,
                    abortSignal: preparedParams.abortSignal,
                    context: {
                        modelEntryName: preparedParams.modelEntryName,
                        agentId: preparedParams.agentId,
                        teamId: preparedParams.teamId,
                        isUserKey: (preparedParams.credentials as any)?.isUserKey || preparedParams.isUserKey,
                        hasFiles: preparedParams.files?.length > 0,
                        modelInfo: preparedParams.modelInfo,
                        credentials: preparedParams.credentials,
                        toolsInfo: {
                            [provider]: preparedParams.toolsInfo[provider],
                        } as TToolsInfo,
                    },
                });

                return response;
            },
            streamRequest: async (params: TLLMConnectorParams) => {
                logger.debug(`streamRequest ${this.name}`, candidate);
                const preparedParams = await this.prepareParams(candidate, params);

                const provider = preparedParams.modelInfo.provider?.toLowerCase();

                const requestParams = {
                    acRequest: candidate.readRequest,
                    body: preparedParams.body,
                    abortSignal: preparedParams.abortSignal,
                    context: {
                        modelEntryName: preparedParams.modelEntryName,
                        agentId: preparedParams.agentId,
                        teamId: preparedParams.teamId,
                        isUserKey: (preparedParams.credentials as any)?.isUserKey || preparedParams.isUserKey,
                        hasFiles: preparedParams.files?.length > 0,
                        modelInfo: preparedParams.modelInfo,
                        credentials: preparedParams.credentials,
                        toolsInfo: {
                            [provider]: preparedParams.toolsInfo[provider],
                        } as TToolsInfo,
                    },
                };

                const response = await this.streamRequest(requestParams);

                return response;
            },

            imageGenRequest: async (params: any) => {
                logger.debug(`imageGenRequest ${this.name}`, candidate);
                const preparedParams = await this.prepareParams(candidate, params);

                const response = await this.imageGenRequest({
                    acRequest: candidate.readRequest,
                    body: preparedParams.body,
                    context: {
                        modelEntryName: preparedParams.modelEntryName,
                        isUserKey: (preparedParams.credentials as any)?.isUserKey || preparedParams.isUserKey,
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
                logger.debug(`imageEditRequest ${this.name}`, candidate);
                const preparedParams = await this.prepareParams(candidate, params);

                const response = await this.imageEditRequest({
                    acRequest: candidate.readRequest,
                    body: preparedParams.body,
                    context: {
                        modelEntryName: preparedParams.modelEntryName,
                        isUserKey: (preparedParams.credentials as any)?.isUserKey || preparedParams.isUserKey,
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
    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto', modelInfo = null }) {
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

    private async prepareParams(candidate: AccessCandidate, params: TLLMConnectorParams): Promise<TLLMPreparedParams> {
        const modelsProvider: ModelsProviderConnector = ConnectorService.getModelsProviderConnector();
        // Extract files and abortSignal from the original parameters to avoid overwriting the original constructor
        const { files, abortSignal, ...restParams } = params;

        const clonedParams = JSON.parse(JSON.stringify(restParams)); // Avoid mutation of the original params

        // Format the parameters to ensure proper type of values
        const _params: TLLMPreparedParams = this.formatParamValues(clonedParams);

        // Re-attach non-serializable properties ignored before cloning
        _params.abortSignal = abortSignal;
        _params.files = files;

        const model = _params.model;
        const teamId = await this.getTeamId(candidate);

        // We need the model entry name for usage reporting
        _params.modelEntryName = typeof model === 'string' ? model : model?.modelEntryName || model?.modelId;
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

        _params.credentials = await getLLMCredentials(candidate, modelInfo);

        //_params.model = (await modelProviderCandidate.getModelId(model)) || model;

        _params.baseURL = modelInfo?.baseURL;
        // if (!isStandardLLM) _params.modelInfo = modelInfo as TCustomLLMModel; //only if custom LLM ?
        _params.modelInfo = modelInfo as TCustomLLMModel; // We need model info for both standard and custom LLMs

        if (_params.maxTokens) {
            _params.maxTokens = await modelProviderCandidate.adjustMaxCompletionTokens(model, _params.maxTokens, _params?.isUserKey as boolean);
        } else {
            // max output tokens is mandatory for Anthropic models
            // We provide the default max output tokens here to avoid some complexity in reqBodyAdapter()
            _params.maxTokens = await modelProviderCandidate.getMaxCompletionTokens(model, _params?.isUserKey as boolean);
        }

        _params.model = await modelProviderCandidate.getModelId(model);

        const features = modelInfo?.features || [];

        _params.capabilities = {
            search: features.includes('search'),
            reasoning: features.includes('reasoning'),
            imageGeneration: features.includes('image-generation'),
        };

        // We're using an object with providers instead of setting toolsInfo directly based on the provider,
        // so the code stays clean and easy to read in connectors like toolsInfo.openai.webSearch or toolsInfo.xai.search.
        // it helps prevent errors such as mistakenly using toolsInfo.search in the OpenAI connector and similar cases.
        // This also helps enable autocomplete, so when typing toolsInfo.openai, it shows suggestions like webSearch.
        _params.toolsInfo = {
            openai: await this.prepareOpenAIToolsInfo(_params),
            xai: await this.prepareXAIToolsInfo(_params),
        };

        // Filter out default and system-specific outputs (e.g., _debug, _error) to isolate custom outputs for structured response
        _params.structuredOutputs = _params?.outputs?.filter((output) => !output.default && !['_debug', '_error'].includes(output.name)) || [];

        // The input adapter transforms the standardized parameters into the specific format required by the target LLM provider
        _params.agentId = candidate.id;
        const body = await this.reqBodyAdapter(_params);

        return { ..._params, body };
    }

    private async prepareOpenAIToolsInfo(params: TLLMPreparedParams) {
        const openAIToolsInfo: TOpenAIToolsInfo = {
            webSearch: {
                enabled: params?.useWebSearch && params.capabilities.search === true,
                contextSize: params?.webSearchContextSize || 'medium',
            },
        };

        if (params?.webSearchCity) {
            openAIToolsInfo.webSearch.city = params?.webSearchCity;
        }

        if (params?.webSearchCountry) {
            openAIToolsInfo.webSearch.country = params?.webSearchCountry;
        }

        if (params?.webSearchRegion) {
            openAIToolsInfo.webSearch.region = params?.webSearchRegion;
        }

        if (params?.webSearchTimezone) {
            openAIToolsInfo.webSearch.timezone = params?.webSearchTimezone;
        }

        return openAIToolsInfo;
    }

    private async prepareXAIToolsInfo(params: TLLMPreparedParams) {
        const xaiToolsInfo: TxAIToolsInfo = {
            search: {
                enabled: params?.useSearch === true && params.capabilities.search === true,
            },
        };

        if (params?.searchMode) {
            xaiToolsInfo.search.mode = params?.searchMode;
        }

        if (params?.returnCitations) {
            xaiToolsInfo.search.returnCitations = params?.returnCitations;
        }

        if (params?.maxSearchResults) {
            xaiToolsInfo.search.maxResults = params?.maxSearchResults;
        }

        if (params?.searchDataSources) {
            xaiToolsInfo.search.dataSources = params?.searchDataSources;
        }

        if (params?.searchCountry) {
            xaiToolsInfo.search.country = params?.searchCountry;
        }

        if (params?.excludedWebsites) {
            xaiToolsInfo.search.excludedWebsites = params?.excludedWebsites;
        }

        if (params?.allowedWebsites) {
            xaiToolsInfo.search.allowedWebsites = params?.allowedWebsites;
        }

        if (params?.includedXHandles) {
            xaiToolsInfo.search.includedXHandles = params?.includedXHandles;
        }

        if (params?.excludedXHandles) {
            xaiToolsInfo.search.excludedXHandles = params?.excludedXHandles;
        }

        if (params?.postFavoriteCount) {
            xaiToolsInfo.search.postFavoriteCount = params?.postFavoriteCount;
        }

        if (params?.postViewCount) {
            xaiToolsInfo.search.postViewCount = params?.postViewCount;
        }

        if (params?.rssLinks) {
            xaiToolsInfo.search.rssLinks = params?.rssLinks;
        }

        if (params?.safeSearch) {
            xaiToolsInfo.search.safeSearch = params?.safeSearch;
        }

        if (params?.fromDate) {
            xaiToolsInfo.search.fromDate = params?.fromDate;
        }

        if (params?.toDate) {
            xaiToolsInfo.search.toDate = params?.toDate;
        }

        return xaiToolsInfo;
    }

    // TODO [Forhad]: apply proper typing for _value and return value
    private formatParamValues(params: Record<string, string | number | string[] | TLLMMessageBlock[]>): any {
        let _params = {};

        for (const [key, value] of Object.entries(params)) {
            let _value: any = value;

            // Array parameters that can be separated by comma or newline
            const arrayParams = ['stopSequences', 'excludedWebsites', 'allowedWebsites', 'includedXHandles', 'excludedXHandles', 'rssLinks'];

            if (arrayParams.includes(key)) {
                if (_value && typeof _value === 'string') {
                    // Split by comma or newline, then filter out empty strings
                    _value = _value
                        .split(/[,\n]/)
                        .map((item) => item.trim())
                        .filter((item) => item.length > 0);
                } else if (Array.isArray(_value)) {
                    _value = _value;
                } else {
                    _value = _value ? [_value] : null;
                }
            }

            // When we have a string that is a number, we need to convert it to a number
            if (typeof _value === 'string' && _value.trim() !== '' && !isNaN(Number(_value))) {
                _value = +_value;
            }

            //FIXME: to revisit by Alaa-eddine
            // TODO: This part is a bit confusing. We send “consistent” messages to the LLM, but they still aren’t truly consistent. For example, we send { role: 'system', content: 'You are a helpful assistant.' }, which isn’t compatible with Google AI. However, we still need to mark it as `system` because we later convert it to `systemInstruction`. We should revisit the architecture later and make the flow simpler and more straightforward.
            if (key === 'messages') {
                _value = this.getConsistentMessages(_value);
            }

            _params[key] = _value;
        }

        return _params;
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
