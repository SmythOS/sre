import Agent from '@sre/AgentManager/Agent.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { LLMChatResponse, LLMConnector } from './LLM.service/LLMConnector';
import { EventEmitter } from 'events';
import { GenerateImageConfig, TLLMMessageBlock, TLLMMessageRole } from '@sre/types/LLM.types';
import { LLMRegistry } from './LLMRegistry.class';
import { CustomLLMRegistry } from './CustomLLMRegistry.class';

// TODO [Forhad]: apply proper typing
// TODO [Forhad]: Need to merge all the methods with LLMConnector

export class LLMInference {
    private model: string;
    private llmConnector: LLMConnector;

    public static async getInstance(model: string, teamId?: string) {
        const llmInference = new LLMInference();

        const isStandardLLM = LLMRegistry.isStandardLLM(model);

        if (isStandardLLM) {
            const llmProvider = LLMRegistry.getProvider(model);

            if (llmProvider) {
                llmInference.llmConnector = ConnectorService.getLLMConnector(llmProvider);
            }
        } else if (teamId) {
            const customLLMRegistry = await CustomLLMRegistry.getInstance(teamId);
            const llmProvider = customLLMRegistry.getProvider(model);

            if (llmProvider) {
                llmInference.llmConnector = ConnectorService.getLLMConnector(llmProvider);
            }
        }

        llmInference.model = model;

        return llmInference;
    }

    public get connector(): LLMConnector {
        return this.llmConnector;
    }

    public async promptRequest(prompt, config: any = {}, agent: string | Agent, customParams: any = {}) {
        const messages = customParams?.messages || [];

        if (prompt) {
            const _prompt = this.llmConnector.enhancePrompt(prompt, config);
            messages.push({ role: TLLMMessageRole.User, content: _prompt });
        }

        if (!messages?.length) {
            throw new Error('Input prompt is required!');
        }

        // override params with customParams
        let params: any = Object.assign(config.data, { ...customParams, messages });

        const agentId = agent instanceof Agent ? agent.id : agent;

        if (!this.llmConnector) {
            throw new Error(`Model ${params.model} not supported`);
        }

        if (!params.model) {
            params.model = this.model;
        }

        try {
            let response: LLMChatResponse = await this.llmConnector.user(AccessCandidate.agent(agentId)).chatRequest(params);

            const result = this.llmConnector.postProcess(response?.content);
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

        const promises = [];
        const _fileSources = [];

        for (let image of fileSources) {
            const binaryInput = BinaryInput.from(image);
            _fileSources.push(binaryInput);
            promises.push(binaryInput.upload(AccessCandidate.agent(agentId)));
        }

        await Promise.all(promises);

        const params = config.data;

        params.fileSources = _fileSources;

        if (!params.model) {
            params.model = this.model;
        }

        try {
            prompt = this.llmConnector.enhancePrompt(prompt, config);
            let response: LLMChatResponse = await this.llmConnector.user(AccessCandidate.agent(agentId)).visionRequest(prompt, params);

            const result = this.llmConnector.postProcess(response?.content);

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

        const promises = [];
        const _fileSources = [];

        for (let image of fileSources) {
            const binaryInput = BinaryInput.from(image);
            _fileSources.push(binaryInput);
            promises.push(binaryInput.upload(AccessCandidate.agent(agentId)));
        }

        await Promise.all(promises);

        const params = config.data;

        params.fileSources = _fileSources;

        if (!params.model) {
            params.model = this.model;
        }

        try {
            prompt = this.llmConnector.enhancePrompt(prompt, config);
            let response: LLMChatResponse = await this.llmConnector.user(AccessCandidate.agent(agentId)).multimodalRequest(prompt, params);

            const result = this.llmConnector.postProcess(response?.content);

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

        return this.llmConnector.user(AccessCandidate.agent(agentId)).imageGenRequest(prompt, params);
    }

    public async toolRequest(params: any, agent: string | Agent) {
        if (!params.messages || !params.messages?.length) {
            throw new Error('Input messages are required.');
        }

        const model = params.model || this.model;

        try {
            const agentId = agent instanceof Agent ? agent.id : agent;

            return this.llmConnector.user(AccessCandidate.agent(agentId)).toolRequest({ ...params, model });
        } catch (error: any) {
            console.error('Error in toolRequest: ', error);

            throw error;
        }
    }

    public async streamToolRequest(params: any, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;

        return this.llmConnector.user(AccessCandidate.agent(agentId)).streamToolRequest(params);
    }

    public async streamRequest(params: any, agent: string | Agent) {
        const agentId = agent instanceof Agent ? agent.id : agent;
        try {
            if (!params.messages || !params.messages?.length) {
                throw new Error('Input messages are required.');
            }

            const model = params.model || this.model;

            return await this.llmConnector.user(AccessCandidate.agent(agentId)).streamRequest({ ...params, model });
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

    public getConsistentMessages(messages: TLLMMessageBlock[]) {
        if (!messages?.length) {
            throw new Error('Input messages are required.');
        }

        try {
            return this.llmConnector.getConsistentMessages(messages);
        } catch (error) {
            console.error('Error in getConsistentMessages: ', error);

            return messages; // if something goes wrong then we return the original messages
        }
    }
}
