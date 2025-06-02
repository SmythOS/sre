import Joi from 'joi';

import { Agent } from '@sre/AgentManager/Agent.class';
import { Conversation } from '@sre/helpers/Conversation.helper';
import { TemplateString } from '@sre/helpers/TemplateString.helper';

import { Component } from './Component.class';

export class GPTPlugin extends Component {
    protected configSchema = Joi.object({
        model: Joi.string().optional(),
        openAiModel: Joi.string().optional(), // for backward compatibility
        specUrl: Joi.string().max(2048).uri().required().description('URL of the OpenAPI specification'),
        descForModel: Joi.string().max(5000).required().allow('').label('Description for Model'),
        name: Joi.string().max(500).required().allow(''),
        desc: Joi.string().max(5000).required().allow('').label('Description'),
        logoUrl: Joi.string().max(8192).allow(''),
        id: Joi.string().max(200),
        version: Joi.string().max(100).allow(''),
        domain: Joi.string().max(253).allow(''),
    });

    constructor() {
        super();
    }

    init() {}

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);

        logger.debug(`=== Open API Log ===`);

        try {
            const specUrl = config?.data?.specUrl;

            if (!specUrl) {
                return { _error: 'Please provide a Open API Specification URL!', _debug: logger.output };
            }

            const model = config?.data?.model || config?.data?.openAiModel;
            const descForModel = TemplateString(config?.data?.descForModel).parse(input).result;
            let prompt = '';

            if (input?.Prompt) {
                prompt = typeof input?.Prompt === 'string' ? input?.Prompt : JSON.stringify(input?.Prompt);
            } else if (input?.Query) {
                prompt = typeof input?.Query === 'string' ? input?.Query : JSON.stringify(input?.Query);
            }

            if (!prompt) {
                return { _error: 'Please provide a prompt', _debug: logger.output };
            }

            // TODO [Forhad]: Need to check and validate input prompt token

            const conv = new Conversation(model, specUrl, { systemPrompt: descForModel, agentId: agent?.id });

            const result = await conv.prompt(prompt);

            logger.debug(`Response:\n`, result, '\n');

            return { Output: result, _debug: logger.output };
        } catch (error: any) {
            console.error('Error on running Open API: ', error);
            return { _error: `Error on running Open API!\n${error?.message || JSON.stringify(error)}`, _debug: logger.output };
        }
    }
}
