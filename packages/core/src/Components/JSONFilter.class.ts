import Joi from 'joi';

import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';

export class JSONFilter extends Component {
    protected configSchema = Joi.object({
        fields: Joi.string().max(30000).allow('').label('Prompt'),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config);
        logger.debug(`=== JSONFilter Log ===`);
        let Output = {};
        let _error = null;
        try {
            const componentId = config.id;
            const fields = config.data.fields;
            const obj = input.Input;

            Output = filterFields(obj, fields);
            logger.debug(`Output filtered`);
        } catch (error: any) {
            _error = error;
            logger.error(` JSONFilter Error`, error);
        }
        return { Output, _error, _debug: logger.output };
    }
}

function filterFields(obj, fields) {
    const fieldList = fields?.split(',').map((field) => field.trim());

    function filterObject(obj) {
        if (Array.isArray(obj)) {
            return obj.map(filterObject);
        } else if (obj !== null && typeof obj === 'object') {
            return Object.keys(obj)
                .filter((key) => fieldList.includes(key))
                .reduce((acc, key) => {
                    acc[key] = filterObject(obj[key]);
                    return acc;
                }, {});
        }
        return obj;
    }

    return filterObject(obj);
}

export default JSONFilter;
