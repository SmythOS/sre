import Agent from '@sre/AgentManager/Agent.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { LLMChatResponse, LLMConnector } from './LLM.service/LLMConnector';
import models from './models';

export class LLMHelper {
    private _llmConnector: LLMConnector;
    private _modelId: string;
    private _modelInfo: any;

    constructor(private model: string) {
        const llmName = models[model]?.llm;
        this._modelId = models[model]?.alias || model;
        this._modelInfo = models[this._modelId];
        this._llmConnector = ConnectorService.getLLMConnector(llmName);
    }

    static load(model: string) {
        //TODO: cache instances
        return new LLMHelper(model);
    }

    public get modelInfo(): any {
        return this._modelInfo;
    }
    public get connector(): LLMConnector {
        return this._llmConnector;
    }

    public async promptRequest(prompt, config: any = {}, agent: string | Agent, customParams: any = {}) {
        if (!prompt && !customParams.messages?.length) {
            throw new Error('Prompt or messages are required');
        }

        if (!this._llmConnector) {
            throw new Error(`Model ${this.model} not supported`);
        }
        const agentId = agent instanceof Agent ? agent.id : agent;
        const params: any = await this._llmConnector.extractLLMComponentParams(config);
        params.model = this._modelId;

        //override params with customParams
        Object.assign(params, customParams);

        try {
            prompt = this._llmConnector.enhancePrompt(prompt, config);

            let response: LLMChatResponse = await this._llmConnector.user(AccessCandidate.agent(agentId)).chatRequest(prompt, params);

            const result = this._llmConnector.postProcess(response?.content);
            if (result.error) {
                // If the model stopped before completing the response, this is usually due to output token limit reached.
                if (response.finishReason !== 'stop') {
                    throw new Error('The model stopped before completing the response, this is usually due to output token limit reached.');
                }

                // If the model stopped due to other reasons, throw the error
                throw new Error(result.error);
            }
            return result;
        } catch (error: any) {
            console.error('Error in chatRequest: ', error);

            throw error;
        }
    }

    public async visionRequest(prompt, fileSources: string[], config: any = {}, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;
        const params: any = await this._llmConnector.extractVisionLLMParams(config);
        params.model = this._modelId;

        const promises = [];
        const _fileSources = [];

        for (let image of fileSources) {
            const binaryInput = BinaryInput.from(image);
            _fileSources.push(binaryInput);
            promises.push(binaryInput.upload(AccessCandidate.agent(agentId)));
        }

        await Promise.all(promises);

        params.fileSources = _fileSources;

        try {
            prompt = this._llmConnector.enhancePrompt(prompt, config);
            let response: LLMChatResponse = await this._llmConnector.user(AccessCandidate.agent(agentId)).visionRequest(prompt, params);

            const result = this._llmConnector.postProcess(response?.content);

            if (result.error) {
                if (response.finishReason !== 'stop') {
                    throw new Error('The model stopped before completing the response, this is usually due to output token limit reached.');
                }

                // If the model stopped due to other reasons, throw the error
                throw new Error(result.error);
            }

            return result;
        } catch (error: any) {
            console.error('Error in visionRequest: ', error);

            throw error;
        }
    }

    public async toolRequest(params: any, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;
        return this._llmConnector.user(AccessCandidate.agent(agentId)).toolRequest(params);
    }

    public async streamToolRequest(params: any, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;
        return this._llmConnector.user(AccessCandidate.agent(agentId)).streamToolRequest(params);
    }

    public async streamRequest(params: any, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;
        return this._llmConnector.user(AccessCandidate.agent(agentId)).streamRequest(params);
    }
}
