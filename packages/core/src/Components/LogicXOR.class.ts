import { IAgent as Agent } from '@sre/types/Agent.types';
import { Component } from './Component.class';

export class LogicXOR extends Component {
    protected schema = {
        name: 'LogicXOR',
        description: 'Perform logical XOR operation on multiple inputs',
        inputs: {},
        outputs: {
            Output: {
                type: 'Boolean',
                default: true,
                description: 'XOR result - true if exactly one input is truthy',
            },
            Verified: {
                type: 'Boolean',
                description: 'Present when exactly one input is truthy',
            },
            Unverified: {
                type: 'Boolean',
                description: 'Present when zero or more than one input is truthy',
            },
            _debug: {
                type: 'Any',
                description: 'Debug output from the component',
            },
        },
    };
    constructor() {
        super();
    }

    init() {}

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);
        const result: any = { Output: undefined };
        let trueCount = 0;

        logger.debug(`=== LogicXOR Log ===`);
        logger.debug(' Input:');

        for (let cfgInput of config.inputs) {
            logger.debug(`${cfgInput.name}: ${input?.[cfgInput.name]}`);

            // counts the number of set inputs
            if (input[cfgInput.name]) {
                trueCount++;
            }
        }
        // checks if only one input is set, to trigger output
        if (trueCount === 1) {
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
