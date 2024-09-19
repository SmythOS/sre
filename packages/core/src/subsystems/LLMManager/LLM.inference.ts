import Agent from '@sre/AgentManager/Agent.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { LLMChatResponse, LLMConnector } from './LLM.service/LLMConnector';
import { EventEmitter } from 'events';
import { GenerateImageConfig } from '@sre/types/LLM.types';
import { LLMHelper } from './LLM.helper';

export class LLMInference {
    private modelName: string;
    private _llmConnector: LLMConnector;
    private _llmHelper: LLMHelper;

    static async load(modelName: string, teamId?: string): Promise<LLMInference> {
        const llmHelper = await LLMHelper.load(teamId);
        const llmInference = new LLMInference();

        const llmRegistry = llmHelper.getModelRegistry();

        const provider = llmRegistry.getProvider(modelName);

        llmInference.modelName = llmRegistry.getModelName(modelName);
        llmInference._llmConnector = ConnectorService.getLLMConnector(provider);

        llmInference._llmConnector.llmHelper = llmHelper;
        llmInference._llmHelper = llmHelper;

        return llmInference;
    }

    public get llmHelper(): LLMHelper {
        return this._llmHelper;
    }

    public get connector(): LLMConnector {
        return this._llmConnector;
    }

    public async promptRequest(prompt, config: any = {}, agent: string | Agent, customParams: any = {}) {
        if (!prompt && !customParams.messages?.length) {
            throw new Error('Prompt or messages are required');
        }

        if (!this._llmConnector) {
            throw new Error(`Model ${this.modelName} not supported`);
        }
        const agentId = agent instanceof Agent ? agent.id : agent;
        const params: any = await this._llmConnector.extractLLMComponentParams(config);
        params.model = this.modelName;

        // We pass teamId within the params as it required to get vault keys for Bedrock and VertexAI
        params.teamId = agent instanceof Agent && agent.teamId;

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
        params.model = this.modelName;

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

    // multimodalRequest is the same as visionRequest. visionRequest will be deprecated in the future.
    public async multimodalRequest(prompt, fileSources: string[], config: any = {}, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;
        const params: any = await this._llmConnector.extractVisionLLMParams(config);
        params.model = this.modelName;
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
            let response: LLMChatResponse = await this._llmConnector.user(AccessCandidate.agent(agentId)).multimodalRequest(prompt, params);

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
            console.error('Error in multimodalRequest: ', error);

            throw error;
        }
    }

    public async imageGenRequest(prompt: string, params: GenerateImageConfig, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;
        params.model = this.modelName;

        return this._llmConnector.user(AccessCandidate.agent(agentId)).imageGenRequest(prompt, params);
    }

    public async toolRequest(params: any, agent: string | Agent) {
        if (!params.messages || !params.messages?.length) {
            throw new Error('Input messages are required.');
        }

        try {
            const agentId = agent instanceof Agent ? agent.id : agent;
            params.model = this.modelName;
            return this._llmConnector.user(AccessCandidate.agent(agentId)).toolRequest(params);
        } catch (error: any) {
            console.error('Error in toolRequest: ', error);

            throw error;
        }
    }

    public async streamToolRequest(params: any, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;
        return this._llmConnector.user(AccessCandidate.agent(agentId)).streamToolRequest(params);
    }

    public async streamRequest(params: any, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;
        try {
            if (!params.messages || !params.messages?.length) {
                throw new Error('Input messages are required.');
            }

            params.model = this.modelName;
            return await this._llmConnector.user(AccessCandidate.agent(agentId)).streamRequest(params);
        } catch (error) {
            console.error('Error in streamRequest:', error);

            const dummyEmitter = new EventEmitter();
            process.nextTick(() => {
                dummyEmitter.emit('error', error);
                dummyEmitter.emit('end');
            });
            return dummyEmitter;
        }
    }
}
