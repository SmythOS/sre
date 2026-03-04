import Joi from 'joi';

import { ConnectorService } from '@sre/Core/ConnectorsService';
import { TemplateString } from '@sre/helpers/TemplateString.helper';

import { IAgent as Agent } from '@sre/types/Agent.types';
import { Conversation } from '@sre/helpers/Conversation.helper';
import { Component } from './Component.class';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

export class AgentPlugin extends Component {
    protected configSchema = Joi.object({
        agentId: Joi.string().max(200).required(),
        openAiModel: Joi.string().max(200).optional(), // for backward compatibility
        model: Joi.string().max(200).optional(),
        descForModel: Joi.string().max(5000).allow('').label('Description for Model'),
        id: Joi.string().max(200),
        name: Joi.string().max(500),
        desc: Joi.string().max(5000).allow('').label('Description'),
        logoUrl: Joi.string().max(8192).allow(''),
        version: Joi.string().max(100).allow(''),
        domain: Joi.string().max(253).allow(''),
    });

    constructor() {
        super();
    }
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);

        logger.debug(`=== Agent Plugin Log ===`);

        try {
            const subAgentId = config.data?.agentId;

            if (!subAgentId) {
                return { _error: 'Agent Component ID is required!', _debug: logger.output };
            }

            //tag this request to tell the nested agent that the call comes from internal agent
            const reqTag = agent.agentRuntime?.reqTag;

            const model = config?.data?.model || config?.data?.openAiModel;
            const descForModel = TemplateString(config?.data?.descForModel).parse(input).result;
            const prompt = typeof input?.Prompt === 'string' ? input?.Prompt : JSON.stringify(input?.Prompt);

            const agentDataConnector = ConnectorService.getAgentDataConnector();

            //let subAgentDomain = await isDeployed(subAgentId);
            // when domain found for sub agent, that means it's deployed
            const isSubAgentDeployed = await agentDataConnector.isDeployed(subAgentId);

            let version = config.data?.version || '';

            logger.debug('Version: ', version);

            if (version === 'same-as-parent') {
                const isParentAgentDeployed = await agentDataConnector.isDeployed(agent?.id);

                if (isParentAgentDeployed) {
                    if (isSubAgentDeployed) {
                        version = 'latest';
                    } else {
                        return {
                            _error: `Call failed, Agent '${config.data?.name}' (${subAgentId}) is not deployed. Please deploy the agent and try again.`,
                            _debug: logger.output,
                        };
                    }
                } else {
                    version = ''; // empty string ('') means latest dev version
                }
            } else if (version === 'dev-latest') {
                version = '';
            } else if (version === 'prod-latest') {
                if (isSubAgentDeployed) {
                    version = 'latest';
                } else {
                    return {
                        _error: `Call failed, Agent '${config.data?.name}' (${subAgentId}) is not deployed. Please deploy the agent and try again.`,
                        _debug: logger.output,
                    };
                }
            }

            const conv = new Conversation(model, subAgentId, { systemPrompt: descForModel, agentVersion: version });

            // # Region: enhance the prompt to produce a JSON output format based on the available component outputs.
            const llmInference: LLMInference = await LLMInference.getInstance(model, AccessCandidate.agent(agent.id));

            // if the llm is undefined, then it means we removed the model from our system
            if (!llmInference.connector) {
                return {
                    _error: `The model '${model}' is not available. Please try a different one.`,
                    _debug: logger.output,
                };
            }
            const enhancedPrompt = llmInference.connector.enhancePrompt(prompt, config);
            // # End Region: prompt enhancement

            const result = await conv.prompt(enhancedPrompt, {
                'X-AGENT-ID': subAgentId,
                'X-AGENT-VERSION': version,
                'X-REQUEST-TAG': reqTag, //request Tag identifies the request and tells the called agent that the call comes from internal agent
                'x-caller-session-id': agent.callerSessionId,
            });

            const processedResponse = llmInference.connector.postProcess(result);

            logger.debug(`Response:\n`, processedResponse, '\n');

            return { Response: processedResponse, _debug: logger.output };
        } catch (error: any) {
            console.error('Error on running Agent Component: ', error);
            return { _error: `Error on running Agent Component!\n${error?.message || JSON.stringify(error)}`, _debug: logger.output };
        }
    }
}
