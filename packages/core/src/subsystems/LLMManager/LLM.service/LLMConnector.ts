import Agent from '@sre/AgentManager/Agent.class';
import { Connector } from '@sre/Core/Connector.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { JSONContent } from '@sre/helpers/JsonContent.helper';
import { TLLMParams, TLLMMessageBlock, TLLMToolResultMessageBlock, ToolData, TLLMProvider } from '@sre/types/LLM.types';
import EventEmitter from 'events';
import { Readable } from 'stream';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { LLMRegistry } from '@sre/LLMManager/LLMRegistry.class';
import { CustomLLMRegistry } from '@sre/LLMManager/CustomLLMRegistry.class';

const console = Logger('LLMConnector');

export interface ILLMConnectorRequest {
    chatRequest(params: any): Promise<any>;
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
    protected abstract chatRequest(acRequest: AccessRequest, params: any): Promise<LLMChatResponse>;
    protected abstract visionRequest(acRequest: AccessRequest, prompt, params: any, agent: string | Agent): Promise<LLMChatResponse>;
    protected abstract multimodalRequest(acRequest: AccessRequest, prompt, params: any, agent: string | Agent): Promise<LLMChatResponse>;
    protected abstract toolRequest(acRequest: AccessRequest, params: any): Promise<any>;
    protected abstract streamToolRequest(acRequest: AccessRequest, params: any): Promise<any>;
    protected abstract streamRequest(acRequest: AccessRequest, params: any): Promise<EventEmitter>;
    protected abstract imageGenRequest(acRequest: AccessRequest, prompt, params: any): Promise<ImagesResponse>;

    public user(candidate: AccessCandidate): ILLMConnectorRequest {
        if (candidate.role !== 'agent') throw new Error('Only agents can use LLM connector');

        return {
            chatRequest: async (params: any) => {
                const _params: TLLMParams = await this.prepareParams(candidate, params);

                return this.chatRequest(candidate.readRequest, _params);
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

                return this.imageGenRequest(candidate.readRequest, prompt, _params);
            },
            toolRequest: async (params: any) => {
                const _params: TLLMParams = await this.prepareParams(candidate, params);

                return this.toolRequest(candidate.readRequest, _params);
            },
            streamToolRequest: async (params: any) => {
                const _params: TLLMParams = await this.prepareParams(candidate, params);

                return this.streamToolRequest(candidate.readRequest, _params);
            },
            streamRequest: async (params: any) => {
                const _params: TLLMParams = await this.prepareParams(candidate, params);

                return this.streamRequest(candidate.readRequest, _params);
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

    // TODO [Forhad]: simplify this method
    private async prepareParams(candidate: AccessCandidate, params: any) {
        const _params = JSON.parse(JSON.stringify(params)); // Avoid mutation of the original params
        _params.fileSources = params?.fileSources; // Assign fileSource from the original parameters to avoid overwriting the original constructor

        const model = _params.model;
        const accountConnector: AccountConnector = ConnectorService.getAccountConnector();
        const vaultConnector = ConnectorService.getVaultConnector();

        if (!accountConnector) throw new Error('Account Connector unavailable, cannot proceed');
        if (!vaultConnector) throw new Error('Vault Connector unavailable, cannot proceed');

        const isStandardLLM = LLMRegistry.isStandardLLM(model);

        if (isStandardLLM) {
            const llmProvider = LLMRegistry.getProvider(model);

            _params.credentials = {
                apiKey: await vaultConnector
                    .user(candidate)
                    .get(llmProvider)
                    .catch(() => ''),
            };

            if (_params.maxTokens) {
                _params.maxTokens = LLMRegistry.adjustMaxCompletionTokens(_params.model, _params.maxTokens, !!_params?.credentials?.apiKey);
            }

            const baseUrl = LLMRegistry.getBaseURL(params.model);

            if (baseUrl) {
                _params.baseURL = baseUrl;
            }

            _params.model = LLMRegistry.getModelId(model) || model;
        } else {
            const teamId = await accountConnector.getCandidateTeam(candidate);
            const customLLMRegistry = await CustomLLMRegistry.getInstance(teamId);

            const modelInfo = customLLMRegistry.getModelInfo(model);

            _params.modelInfo = modelInfo;

            const llmProvider = customLLMRegistry.getProvider(model);

            if (llmProvider === TLLMProvider.Bedrock) {
                const keyIdName = modelInfo.settings?.keyIDName;
                const secretKeyName = modelInfo.settings?.secretKeyName;
                const sessionKeyName = modelInfo.settings?.sessionKeyName;

                const [keyId, secretKey, sessionKey] = await Promise.all([
                    vaultConnector
                        .user(candidate)
                        .get(keyIdName)
                        .catch(() => ''),
                    vaultConnector
                        .user(candidate)
                        .get(secretKeyName)
                        .catch(() => ''),
                    vaultConnector
                        .user(candidate)
                        .get(sessionKeyName)
                        .catch(() => ''),
                ]);

                _params.credentials = {
                    keyId,
                    secretKey,
                    sessionKey,
                };
            } else if (llmProvider === TLLMProvider.VertexAI) {
                const jsonCredentialsName = modelInfo.settings?.jsonCredentialsName;

                let jsonCredentials = await vaultConnector
                    .user(candidate)
                    .get(jsonCredentialsName)
                    .catch(() => '');

                _params.credentials = JSON.parse(jsonCredentials);
            }

            if (_params.maxTokens) {
                _params.maxTokens = customLLMRegistry.adjustMaxCompletionTokens(model, _params.maxTokens);
            }

            _params.model = customLLMRegistry.getModelId(model) || model;
        }

        return _params;
    }
}
