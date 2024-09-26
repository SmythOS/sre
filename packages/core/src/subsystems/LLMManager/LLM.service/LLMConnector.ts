import Agent from '@sre/AgentManager/Agent.class';
import { Connector } from '@sre/Core/Connector.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import paramMappings from '@sre/LLMManager/paramMappings';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { DEFAULT_MAX_TOKENS_FOR_LLM } from '@sre/constants';
import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { TLLMParams, TLLMMessageBlock, TLLMToolResultMessageBlock, ToolData } from '@sre/types/LLM.types';
import { isDataUrl, isUrl } from '@sre/utils';
import axios from 'axios';
import { encode } from 'gpt-tokenizer';
import imageSize from 'image-size';
import EventEmitter from 'events';
import { Readable } from 'stream';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';

const console = Logger('LLMConnector');

export interface ILLMConnectorRequest {
    chatRequest(prompt, params: any): Promise<any>;
    visionRequest(prompt, params: any): Promise<any>;
    multimodalRequest(prompt, params: any): Promise<any>;
    toolRequest(params: any): Promise<any>;
    streamToolRequest(params: any): Promise<any>;
    streamRequest(params: any): Promise<EventEmitter>;
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
    protected abstract chatRequest(acRequest: AccessRequest, prompt, params: any): Promise<LLMChatResponse>;
    protected abstract visionRequest(acRequest: AccessRequest, prompt, params: any, agent: string | Agent): Promise<LLMChatResponse>;
    protected abstract multimodalRequest(acRequest: AccessRequest, prompt, params: any, agent: string | Agent): Promise<LLMChatResponse>;
    protected abstract toolRequest(acRequest: AccessRequest, params: any): Promise<any>;
    protected abstract streamToolRequest(acRequest: AccessRequest, params: any): Promise<any>;
    protected abstract streamRequest(acRequest: AccessRequest, params: any): Promise<EventEmitter>;
    protected abstract imageGenRequest(acRequest: AccessRequest, prompt, params: any): Promise<ImagesResponse>;

    protected _llmHelper: LLMHelper;

    constructor() {
        super();

        this.llmHelper = new LLMHelper();
    }

    public get llmHelper(): LLMHelper {
        return this._llmHelper;
    }

    public set llmHelper(llmHelper: LLMHelper) {
        this._llmHelper = llmHelper;
    }

    public user(candidate: AccessCandidate): ILLMConnectorRequest {
        if (candidate.role !== 'agent') throw new Error('Only agents can use LLM connector');
        const vaultConnector = ConnectorService.getVaultConnector();
        if (!vaultConnector) throw new Error('Vault Connector unavailable, cannot proceed');

        const llmRegistry = this.llmHelper.ModelRegistry();

        return {
            chatRequest: async (prompt, params: any) => {
                const llmProvider = llmRegistry.getProvider(params.model);
                if (!llmProvider) throw new Error(`Model ${params.model} not supported`);

                params.apiKey = await vaultConnector
                    .user(candidate)
                    .get(llmProvider)
                    .catch((e) => ''); //if vault access is denied we just return empty key

                return this.chatRequest(candidate.readRequest, prompt, params);
            },
            visionRequest: async (prompt, params: any) => {
                const llmProvider = llmRegistry.getProvider(params.model);
                if (!llmProvider) throw new Error(`Model ${params.model} not supported`);

                params.apiKey = await vaultConnector
                    .user(candidate)
                    .get(llmProvider)
                    .catch((e) => ''); //if vault access is denied we just return empty key

                return this.visionRequest(candidate.readRequest, prompt, params, candidate.id);
            },
            multimodalRequest: async (prompt, params: any) => {
                const llmProvider = llmRegistry.getProvider(params.model);
                if (!llmProvider) throw new Error(`Model ${params.model} not supported`);

                params.apiKey = await vaultConnector
                    .user(candidate)
                    .get(llmProvider)
                    .catch((e) => ''); //if vault access is denied we just return empty key

                return this.multimodalRequest(candidate.readRequest, prompt, params, candidate.id);
            },
            imageGenRequest: async (prompt, params: any) => {
                const llmProvider = llmRegistry.getProvider(params.model);
                if (!llmProvider) throw new Error(`Model ${params.model} not supported`);

                params.apiKey = await vaultConnector
                    .user(candidate)
                    .get(llmProvider)
                    .catch((e) => ''); //if vault access is denied we just return empty key

                return this.imageGenRequest(candidate.readRequest, prompt, params);
            },
            toolRequest: async (params: any) => {
                const llmProvider = llmRegistry.getProvider(params.model);
                if (!llmProvider) throw new Error(`Model ${params.model} not supported`);

                params.apiKey = await vaultConnector
                    .user(candidate)
                    .get(llmProvider)
                    .catch((e) => ''); //if vault access is denied we just return empty key

                return this.toolRequest(candidate.readRequest, params);
            },
            streamToolRequest: async (params: any) => {
                const llmProvider = llmRegistry.getProvider(params.model);
                if (!llmProvider) throw new Error(`Model ${params.model} not supported`);

                params.apiKey = await vaultConnector
                    .user(candidate)
                    .get(llmProvider)
                    .catch((e) => ''); //if vault access is denied we just return empty key

                return this.streamToolRequest(candidate.readRequest, params);
            },
            streamRequest: async (params: any) => {
                const llmProvider = llmRegistry.getProvider(params.model);
                if (!llmProvider) throw new Error(`Model ${params.model} not supported`);

                params.apiKey = await vaultConnector
                    .user(candidate)
                    .get(llmProvider)
                    .catch((e) => ''); //if vault access is denied we just return empty key

                return this.streamRequest(candidate.readRequest, params);
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

    // TODO [Forhad]: Need to check if we need the params mapping anymore as we set the parameters explicitly now
    public async extractLLMComponentParams(config: any) {
        const params: TLLMParams = {};
        const model: string = config.data.model;
        // Retrieve the API key and include it in the parameters here, as it is required for the max tokens check.

        const apiKey = '';
        //TODO: implement apiKey extraction from team vault
        //const apiKey = await getLLMApiKey(model, agent?.teamId);
        //if (apiKey) params.apiKey = apiKey;

        /*** Prepare parameters from config data ***/

        // * We need to keep the config.data unchanged to avoid any side effects, especially when run components with loop
        const clonedConfigData = JSON.parse(JSON.stringify(config.data || {}));
        const configParams = {};

        for (const [key, value] of Object.entries(clonedConfigData)) {
            let _value: string | number | string[] | null = value as string;

            // When we have stopSequences, we need to split it into an array
            if (key === 'stopSequences') {
                _value = _value ? _value?.split(',') : null;
            }

            // When we have a string that is a number, we need to convert it to a number
            if (typeof _value === 'string' && !isNaN(Number(_value))) {
                _value = +_value;
            }

            // Always provide safe max tokens based on the model and apiKey
            if (key === 'maxTokens') {
                let maxTokens = Number(_value);

                if (!maxTokens) {
                    throw new Error('Max output token not provided');
                }

                maxTokens = await this.llmHelper
                    .TokenManager()
                    .getSafeMaxTokens({ givenMaxTokens: maxTokens, modelName: model, hasAPIKey: !!apiKey });
                _value = maxTokens;
            }

            configParams[key] = _value;
        }

        /*** Prepare LLM specific parameters ***/

        const llmProvider = this.llmHelper.ModelRegistry().getProvider(model);

        for (const [configKey, paramKey] of Object.entries(paramMappings?.[llmProvider] || {})) {
            // we need to allow 0 as truthy
            if (configParams?.[configKey] !== undefined || configParams?.[configKey] !== null || configParams?.[configKey] !== '') {
                const value = configParams[configKey];

                if (value !== undefined) {
                    params[paramKey as string] = value;
                }
            }
        }

        return params;
    }

    // TODO [Forhad]: Need to support other params like temperature, topP, topK, etc.
    public async extractVisionLLMParams(config: any) {
        const params: TLLMParams = {};
        const model: string = config.data.model;
        // Retrieve the API key and include it in the parameters here, as it is required for the max tokens check.

        const apiKey = '';
        //TODO: implement apiKey extraction from team vault
        //const apiKey = await getLLMApiKey(model, agent?.teamId);
        //if (apiKey) params.apiKey = apiKey;

        const maxTokens =
            (await this.llmHelper
                .TokenManager()
                .getSafeMaxTokens({ givenMaxTokens: +config.data.maxTokens, modelName: model, hasAPIKey: !!apiKey })) || 300;

        const llm = this.llmHelper.ModelRegistry().getProvider(model);

        // as max output token prop name differs based on LLM provider, we need to get the actual prop from paramMappings
        params[paramMappings[llm]?.maxTokens] = maxTokens;

        return params;
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
}
