import Joi from 'joi';

import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';

export default class LogicAtLeast extends Component {
    protected configSchema = Joi.object({
        // TODO (Forhad): Need to check if min and max work instead of the custom validateInteger
        minSetInputs: Joi.number()
            .min(0)
            .max(9)
            // .custom(validateInteger({ min: 0, max: 9 }), 'custom range validation')
            .label('Minimum Inputs'),
    });
    constructor() {
        super();
    }

    init() {}

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config.name);
        const result: any = { Output: undefined };

        if (typeof config.data.minSetInputs !== 'string' || config.data.minSetInputs.trim() === '' || isNaN(Number(config.data.minSetInputs))) {
            return result;
        }

        const minSetInputs = Number(config.data.minSetInputs);
        if (config.inputs.length < minSetInputs) {
            return result;
        }

        let trueCount = 0;
        for (let cfgInput of config.inputs) {
            if (input[cfgInput.name]) {
                trueCount++;
            }
        }

        if (trueCount >= minSetInputs) {
            result.Output = true;
        }

        result.Verified = result.Output !== undefined;
        result.Unverified = !result.Verified;
        if (!result.Verified) delete result.Verified;
        if (!result.Unverified) delete result.Unverified;

        return result;
    }
}
