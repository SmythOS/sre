import { Agent } from '@sre/AgentManager/Agent.class';
import { Component } from './Component.class';

export class LogicXOR extends Component {
    constructor() {
        super();
    }

    init() {}

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const result: any = { Output: undefined };
        let trueCount = 0;

        for (let cfgInput of config.inputs) {
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

        return result;
    }
}

export default LogicXOR;
