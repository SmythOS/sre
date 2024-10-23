import Joi from 'joi';

import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';

export default class CLIInput extends Component {

    protected configSchema = Joi.object({
        endpoint: Joi.string()
            .pattern(/^[a-zA-Z0-9]+([-_][a-zA-Z0-9]+)*$/)
            .max(50)
            .required(),
        method: Joi.string().valid('POST', 'GET').allow(''), //we're accepting empty value because we consider it POST by default.
        description: Joi.string().max(5000).allow(''),
        summary: Joi.string().max(1000).allow(''),
        doc: Joi.string().max(1000).allow(''),
        ai_exposed: Joi.boolean().default(true),
    });

    constructor() {
        super();
    }

    init() { }

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config.name);

        const args = input.slice(2);

        console.log('HERE');
        console.log(args);

        return { args, _debug: logger.output };
    }
}
