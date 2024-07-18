import Joi from 'joi';

import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';

export default class LogicAtMost extends Component {
    protected configSchema = Joi.object({
        // TODO (Forhad): Need to check if min and max work instead of the custom validateInteger
        maxSetInputs: Joi.number()
            .min(0)
            .max(9)
            // .custom(validateInteger({ min: 0, max: 9 }), 'custom range validation')
            .label('Maximum Inputs'),
    });
    constructor() {
        super();
    }

    init() {}

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const result: any = { Output: undefined };

        if (typeof config.data.maxSetInputs !== 'string' || config.data.maxSetInputs.trim() === '' || isNaN(Number(config.data.maxSetInputs))) {
            return result;
        }

        const maxSetInputs = Number(config.data.maxSetInputs);
        if (config.inputs.length < maxSetInputs) {
            return result;
        }

        let trueCount = 0;
        for (let cfgInput of config.inputs) {
            if (input[cfgInput.name]) {
                trueCount++;
                if (trueCount > maxSetInputs) {
                    break;
                }
            }
        }

        if (trueCount <= maxSetInputs) {
            result.Output = true;
        }

        result.Verified = result.Output !== undefined;
        result.Unverified = !result.Verified;
        if (!result.Verified) delete result.Verified;
        if (!result.Unverified) delete result.Unverified;

        return result;
    }
}
