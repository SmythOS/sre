import { ConnectorService } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { LLMConnector } from './LLM.service/LLMConnector';
import models from './models';
import Agent from '@sre/AgentManager/Agent.class';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';

export class LLMHelper {
    private _llmConnector: LLMConnector;
    private _modelId: string;

    constructor(private model: string) {
        const llmName = models[model]?.llm;
        this._modelId = models[model]?.alias || model;
        this._llmConnector = ConnectorService.getLLMConnector(llmName);
    }

    static load(model: string) {
        return new LLMHelper(model);
    }
    public get connector(): LLMConnector {
        return this._llmConnector;
    }

    public async promptRequest(prompt, config: any = {}) {
        if (!this._llmConnector) return { error: 'LLM request failed', details: `Model ${this.model} not supported` };

        const params: any = await this._llmConnector.extractLLMComponentParams(config);
        params.model = this._modelId;

        try {
            prompt = this._llmConnector.enhancePrompt(prompt, config);
            let response = await this._llmConnector.chatRequest(prompt, params);

            return this._llmConnector.postProcess(response);
        } catch (error: any) {
            return { error: 'LLM request failed', details: error?.message || error?.toString() };
        }
    }

    public async visionRequest(prompt, sources: BinaryInput[], config: any = {}, agent: Agent) {
        const params: any = await this._llmConnector.extractVisionLLMParams(config);
        params.model = this._modelId;
        params.sources = sources;

        try {
            prompt = this._llmConnector.enhancePrompt(prompt, config);
            let response = await this._llmConnector.visionRequest(prompt, params, agent);

            return this._llmConnector.postProcess(response);
        } catch (error: any) {
            return { error: 'LLM request failed', details: error?.message || error?.toString() };
        }
    }

    public async toolRequest(params: any) {
        return this._llmConnector.toolRequest(params);
    }
}
