import Agent from '@sre/AgentManager/Agent.class';
import { Connector } from '@sre/Core/Connector.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import models from '@sre/LLMManager/models';
import paramMappings from '@sre/LLMManager/paramMappings';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { DEFAULT_MAX_TOKENS_FOR_LLM } from '@sre/constants';
import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { LLMParams, LLMMessageBlock, LLMToolResultMessageBlock, ToolData } from '@sre/types/LLM.types';
import { isDataUrl, isUrl } from '@sre/utils';
import axios from 'axios';
import { encode } from 'gpt-tokenizer';
import imageSize from 'image-size';
import EventEmitter from 'events';
import { Readable } from 'stream';
const console = Logger('LLMConnector');

export interface ILLMConnectorRequest {
    chatRequest(prompt, params: any): Promise<any>;
    visionRequest(prompt, params: any): Promise<any>;
    multimodalRequest(prompt, params: any): Promise<any>;
    toolRequest(params: any): Promise<any>;
    streamToolRequest(params: any): Promise<any>;
    streamRequest(params: any): Promise<EventEmitter>;
}

export type LLMChatResponse = {
    content: string;
    finishReason: string;
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

    public user(candidate: AccessCandidate): ILLMConnectorRequest {
        if (candidate.role !== 'agent') throw new Error('Only agents can use LLM connector');
        const vaultConnector = ConnectorService.getVaultConnector();
        if (!vaultConnector) throw new Error('Vault Connector unavailable, cannot proceed');
        return {
            chatRequest: async (prompt, params: any) => {
                const llm = models[params.model]?.llm;
                if (!llm) throw new Error(`Model ${params.model} not supported`);
                params.apiKey = await vaultConnector
                    .user(candidate)
                    .get(llm)
                    .catch((e) => ''); //if vault access is denied we just return empty key
                return this.chatRequest(candidate.readRequest, prompt, params);
            },
            visionRequest: async (prompt, params: any) => {
                const llm = models[params.model]?.llm;
                if (!llm) throw new Error(`Model ${params.model} not supported`);
                params.apiKey = await vaultConnector
                    .user(candidate)
                    .get(llm)
                    .catch((e) => ''); //if vault access is denied we just return empty key
                return this.visionRequest(candidate.readRequest, prompt, params, candidate.id);
            },
            multimodalRequest: async (prompt, params: any) => {
                const llm = models[params.model]?.llm;
                if (!llm) throw new Error(`Model ${params.model} not supported`);
                params.apiKey = await vaultConnector
                    .user(candidate)
                    .get(llm)
                    .catch((e) => ''); //if vault access is denied we just return empty key
                return this.multimodalRequest(candidate.readRequest, prompt, params, candidate.id);
            },
            toolRequest: async (params: any) => {
                const llm = models[params.model]?.llm;
                if (!llm) throw new Error(`Model ${params.model} not supported`);
                params.apiKey = await vaultConnector
                    .user(candidate)
                    .get(llm)
                    .catch((e) => ''); //if vault access is denied we just return empty key
                return this.toolRequest(candidate.readRequest, params);
            },
            streamToolRequest: async (params: any) => {
                const llm = models[params.model]?.llm;
                if (!llm) throw new Error(`Model ${params.model} not supported`);
                params.apiKey = await vaultConnector
                    .user(candidate)
                    .get(llm)
                    .catch((e) => ''); //if vault access is denied we just return empty key
                return this.streamToolRequest(candidate.readRequest, params);
            },
            streamRequest: async (params: any) => {
                const llm = models[params.model]?.llm;
                if (!llm) throw new Error(`Model ${params.model} not supported`);
                params.apiKey = await vaultConnector
                    .user(candidate)
                    .get(llm)
                    .catch((e) => ''); //if vault access is denied we just return empty key
                return this.streamRequest(candidate.readRequest, params);
            },
        };
    }

    private async getSafeMaxTokens(givenMaxTokens: number, model: string, hasApiKey: boolean): Promise<number> {
        let allowedTokens = this.getAllowedCompletionTokens(model, hasApiKey);

        // If the specified max tokens exceed the allowed limit, use the maximum allowed tokens instead.
        let maxTokens = givenMaxTokens > allowedTokens ? allowedTokens : givenMaxTokens;

        return +maxTokens;
    }

    protected async countVisionPromptTokens(prompt: any) {
        let tokens = 0;

        const textObj = prompt?.filter((item) => item.type === 'text');

        /**
         * encodeChat does not support object like {type: 'text', text: 'some text'}
         * so count tokens of the text separately
         * TODO: try to improve this later
         */
        const textTokens = encode(textObj?.[0]?.text).length;

        const images = prompt?.filter((item) => item.type === 'image_url');
        let imageTokens = 0;

        for (const image of images) {
            const image_url = image?.image_url?.url;
            const { width, height } = await _getImageDimensions(image_url);

            const tokens = _countImageTokens(width, height);

            imageTokens += tokens;
        }

        tokens = textTokens + imageTokens;

        return tokens;
    }

    public resolveModelName(model: string) {
        return models[model]?.alias || model;
    }
    private getAllowedContextTokens(model: string, hasTeamAPIKey: boolean = false) {
        const alias = this.resolveModelName(model);

        // Only allow full token limit if the API key is provided by the team
        const maxTokens = hasTeamAPIKey ? models[alias]?.keyOptions?.tokens : models[alias]?.tokens;

        return +(maxTokens ?? DEFAULT_MAX_TOKENS_FOR_LLM);
    }

    protected getAllowedCompletionTokens(model: string, hasTeamAPIKey: boolean = false) {
        const alias = models[model]?.alias || model;

        // Only allow full token limit if the API key is provided by the team
        const maxTokens = hasTeamAPIKey
            ? models[alias]?.keyOptions?.completionTokens || models[alias]?.keyOptions?.tokens
            : models[alias]?.completionTokens || models[alias]?.tokens;

        return +(maxTokens ?? DEFAULT_MAX_TOKENS_FOR_LLM);
    }

    // ! DEPRECATED: will be removed in favor of validateTokensLimit
    public checkTokensLimit({
        model,
        promptTokens,
        completionTokens,
        hasTeamAPIKey = false,
    }: {
        model: string;
        promptTokens: number;
        completionTokens: number;
        hasTeamAPIKey?: boolean;
    }): { isExceeded: boolean; error: string } {
        const allowedContextTokens = this.getAllowedContextTokens(model, hasTeamAPIKey);
        const totalTokens = promptTokens + completionTokens;

        if (totalTokens > allowedContextTokens) {
            return {
                isExceeded: true,
                error: hasTeamAPIKey
                    ? `This models' maximum content length is ${allowedContextTokens} tokens. (This is the sum of your prompt with all variables and the maximum output tokens you've set in Advanced Settings) However, you requested approx ${totalTokens} tokens (${promptTokens} in the prompt, ${completionTokens} in the output). Please reduce the length of either the input prompt or the Maximum output tokens.`
                    : `Input exceeds max tokens limit of ${allowedContextTokens}. Please add your API key to unlock full length.`,
            };
        }

        return { isExceeded: false, error: '' };
    }

    /**
     * Validates if the total tokens (prompt input token + maximum output token) exceed the allowed context tokens for a given model.
     *
     * @param {Object} params - The function parameters.
     * @param {string} params.model - The model identifier.
     * @param {number} params.promptTokens - The number of tokens in the input prompt.
     * @param {number} params.completionTokens - The number of tokens in the output completion.
     * @param {boolean} [params.hasTeamAPIKey=false] - Indicates if the user has a team API key.
     * @throws {Error} - Throws an error if the total tokens exceed the allowed context tokens.
     */
    public validateTokensLimit({
        model,
        promptTokens,
        completionTokens,
        hasTeamAPIKey = false,
    }: {
        model: string;
        promptTokens: number;
        completionTokens: number;
        hasTeamAPIKey?: boolean;
    }): void {
        const allowedContextTokens = this.getAllowedContextTokens(model, hasTeamAPIKey);
        const totalTokens = promptTokens + completionTokens;

        const teamAPIKeyExceededMessage = `This models' maximum content length is ${allowedContextTokens} tokens. (This is the sum of your prompt with all variables and the maximum output tokens you've set in Advanced Settings) However, you requested approx ${totalTokens} tokens (${promptTokens} in the prompt, ${completionTokens} in the output). Please reduce the length of either the input prompt or the Maximum output tokens.`;
        const noAPIKeyExceededMessage = `Input exceeds max tokens limit of ${allowedContextTokens}. Please add your API key to unlock full length.`;

        if (totalTokens > allowedContextTokens) {
            throw new Error(hasTeamAPIKey ? teamAPIKeyExceededMessage : noAPIKeyExceededMessage);
        }
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
            outputKeys.forEach((key) => (outputFormat[key] = '<value>'));

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
        const params: LLMParams = {};
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

                maxTokens = await this.getSafeMaxTokens(maxTokens, model, !!apiKey);
                _value = maxTokens;
            }

            configParams[key] = _value;
        }

        /*** Prepare LLM specific parameters ***/

        const alias = models[model]?.alias || model;
        const llm = models[alias]?.llm;

        for (const [configKey, paramKey] of Object.entries(paramMappings[llm])) {
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
        const params: LLMParams = {};
        const model: string = config.data.model;
        // Retrieve the API key and include it in the parameters here, as it is required for the max tokens check.

        const apiKey = '';
        //TODO: implement apiKey extraction from team vault
        //const apiKey = await getLLMApiKey(model, agent?.teamId);
        //if (apiKey) params.apiKey = apiKey;

        const maxTokens = (await this.getSafeMaxTokens(+config.data.maxTokens, model, !!apiKey)) || 300;

        const alias = models[model]?.alias || model;
        const llm = models[alias]?.llm;

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

    public prepareInputMessageBlocks({
        messageBlock,
        toolsData,
    }: {
        messageBlock: LLMMessageBlock;
        toolsData: ToolData[];
    }): LLMToolResultMessageBlock[] {
        throw new Error('This model does not support tools');
    }

    public hasSystemMessage(messages: any) {
        if (!Array.isArray(messages)) return false;

        return messages?.some((message) => message.role === 'system');
    }

    public separateSystemMessages(messages: LLMMessageBlock[]): {
        systemMessage: LLMMessageBlock | {};
        otherMessages: LLMMessageBlock[];
    } {
        const systemMessage = messages.find((message) => message.role === 'system') || {};
        const otherMessages = messages.filter((message) => message.role !== 'system');

        return { systemMessage, otherMessages };
    }
}

// Function to calculate tokens from image
function _countImageTokens(width: number, height: number, detailMode: string = 'auto') {
    if (detailMode === 'low') return 85;

    const maxDimension = Math.max(width, height);
    const minDimension = Math.min(width, height);
    let scaledMinDimension = minDimension;

    if (maxDimension > 2048) {
        scaledMinDimension = (2048 / maxDimension) * minDimension;
    }

    scaledMinDimension = Math.floor((768 / 1024) * scaledMinDimension);

    let tileSize = 512;
    let tiles = Math.ceil(scaledMinDimension / tileSize);
    if (minDimension !== scaledMinDimension) {
        tiles *= Math.ceil((scaledMinDimension * (maxDimension / minDimension)) / tileSize);
    }

    return tiles * 170 + 85;
}

async function _getImageDimensions(url: string): Promise<{ width: number; height: number }> {
    try {
        let buffer: Buffer;

        if (isDataUrl(url)) {
            const base64Data = url.replace(/^data:image\/\w+;base64,/, '');

            // Create a buffer from the base64-encoded string
            buffer = Buffer.from(base64Data, 'base64');
        } else if (isUrl(url)) {
            const response = await axios.get(url, { responseType: 'arraybuffer' });

            // Convert the response to a buffer
            buffer = Buffer.from(response.data);
        } else {
            throw new Error('Please provide a valid image url!');
        }

        // Use the imageSize module to get the dimensions
        const dimensions = imageSize(buffer);

        return {
            width: dimensions?.width || 0,
            height: dimensions?.height || 0,
        };
    } catch (error) {
        console.error('Error getting image dimensions', error);

        throw new Error('Please provide a valid image url!');
    }
}
