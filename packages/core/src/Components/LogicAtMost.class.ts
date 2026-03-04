import Joi from 'joi';

import { IAgent as Agent } from '@sre/types/Agent.types';
import { Component } from './Component.class';

export class LogicAtMost extends Component {
    protected configSchema = Joi.object({
        // TODO (Forhad): Need to check if min and max work instead of the custom validateInteger
        maxSetInputs: Joi.alternatives([Joi.string(), Joi.number()]) // Value is now a number; keep string fallback for backward compatibility.
            .custom(validateInteger({ min: 0, max: 9 }), 'custom range validation')
            .label('Maximum Inputs'),
    });
    constructor() {
        super();
    }

    init() {}

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);
        const result: any = { Output: undefined };

        logger.debug(`=== LogicAtMost Log ===`);
        logger.debug(' Input:');

        for (let cfgInput of config.inputs) {
            logger.debug(`${cfgInput.name}: ${input?.[cfgInput.name]}`);
        }

        if (config.data.maxSetInputs === '' || isNaN(Number(config.data.maxSetInputs))) {
            logger.debug(''); // empty line
            logger.debug(` Result: \n${JSON.stringify(result, null, 2)}`);
            result._debug = logger.output;
            return result;
        }

        const maxSetInputs = Number(config.data.maxSetInputs);
        if (config.inputs.length < maxSetInputs) {
            logger.debug(''); // empty line
            logger.debug(` Result: \n${JSON.stringify(result, null, 2)}`);
            result._debug = logger.output;
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

        logger.debug(''); // empty line
        logger.debug(` Result: \n${JSON.stringify(result, null, 2)}`);

        result._debug = logger.output;

        return result;
    }
}
interface RangeValidationArgs {
    min?: number;
    max?: number;
}

function validateInteger(args: RangeValidationArgs) {
    return (value: string, helpers: any) => {
        const numValue = Number(value);
        const fieldName = helpers.schema._flags.label || helpers.state.path[helpers.state.path.length - 1];

        // Check if the value is a number
        if (isNaN(numValue)) {
            throw new Error(`The value for '${fieldName}' must be a number`);
        }

        // Range validations
        if (args.min !== undefined && args.max !== undefined) {
            if (numValue < args.min || numValue > args.max) {
                throw new Error(`The value for '${fieldName}' must be from ${args.min} to ${args.max}`);
            }
        } else if (args.min !== undefined) {
            if (numValue < args.min) {
                throw new Error(`The value for '${fieldName}' must be greater or equal to ${args.min}`);
            }
        } else if (args.max !== undefined) {
            if (numValue > args.max) {
                throw new Error(`The value for '${fieldName}' must be less or equal to ${args.max}`);
            }
        }

        return value; // Value is valid
    };
}
