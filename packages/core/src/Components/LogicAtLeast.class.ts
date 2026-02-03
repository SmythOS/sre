import Joi from 'joi';

import { IAgent as Agent } from '@sre/types/Agent.types';
import { Component } from './Component.class';

export class LogicAtLeast extends Component {
    protected configSchema = Joi.object({
        // TODO (Forhad): Need to check if min and max work instead of the custom validateInteger
        minSetInputs: Joi.alternatives([Joi.string(), Joi.number()]) // Value is now a number; keep string fallback for backward compatibility.
            .custom(validateInteger({ min: 0, max: 9 }), 'custom range validation')
            .label('Minimum Inputs'),
    });
    constructor() {
        super();
    }

    init() {}

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);
        const result: any = { Output: undefined };

        logger.debug(`=== LogicAtLeast Log ===`);
        logger.debug(' Input:');

        for (let cfgInput of config.inputs) {
            logger.debug(`${cfgInput.name}: ${input?.[cfgInput.name]}`);
        }

        if (config.data.minSetInputs === '' || isNaN(Number(config.data.minSetInputs))) {
            logger.debug(''); // empty line
            logger.debug(` Result: \n${JSON.stringify(result, null, 2)}`);
            result._debug = logger.output;
            return result;
        }

        const minSetInputs = Number(config.data.minSetInputs);
        if (config.inputs.length < minSetInputs) {
            logger.debug(''); // empty line
            logger.debug(` Result: \n${JSON.stringify(result, null, 2)}`);
            result._debug = logger.output;
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
