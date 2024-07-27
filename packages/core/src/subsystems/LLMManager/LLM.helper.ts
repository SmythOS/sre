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

    public async promptRequest(prompt, config: any = {}, agent: string | Agent) {
        if (!this._llmConnector) return { error: 'LLM request failed', details: `Model ${this.model} not supported` };
        const agentId = agent instanceof Agent ? agent.id : agent;
        const params: any = await this._llmConnector.extractLLMComponentParams(config);
        params.model = this._modelId;

        try {
            prompt = this._llmConnector.enhancePrompt(prompt, config);

            let response: LLMChatResponse = await this._llmConnector.user(AccessCandidate.agent(agentId)).chatRequest(prompt, params);

            const result = this._llmConnector.postProcess(response?.content);
            if (result.error && response.finishReason !== 'stop') {
                result.details = 'The model stopped before completing the response, this is usually due to output token limit reached.';
            }
            return result;
        } catch (error: any) {
            return { error: 'LLM request failed', details: error?.message || error?.toString() };
        }
    }

    public async visionRequest(prompt, sources: BinaryInput[], config: any = {}, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;
        const params: any = await this._llmConnector.extractVisionLLMParams(config);
        params.model = this._modelId;
        params.sources = sources;

        try {
            prompt = this._llmConnector.enhancePrompt(prompt, config);
            let response: LLMChatResponse = await this._llmConnector.user(AccessCandidate.agent(agentId)).visionRequest(prompt, params);

            const result = this._llmConnector.postProcess(response?.content);
            if (result.error && response.finishReason !== 'stop') {
                result.details = 'The model stopped before completing the response, this is usually due to output token limit reached.';
            }
            return result;
        } catch (error: any) {
            return { error: 'LLM request failed', details: error?.message || error?.toString() };
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
}
