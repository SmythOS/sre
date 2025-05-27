import { Agent } from '@sre/AgentManager/Agent.class';
import { Component } from './Component.class';

export class LogicAND extends Component {
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);
        const result: any = { Output: true };

        for (let cfgInput of config.inputs) {
            // check if all inputs are set (expected inputs are in "config.inputs" actual inputs are in "input")
            if (!input[cfgInput.name]) {
                result.Output = undefined;
                break;
            }
        }

        result.Verified = result.Output !== undefined;
        result.Unverified = !result.Verified;
        if (!result.Verified) delete result.Verified;
        if (!result.Unverified) delete result.Unverified;
        return result;
    }
}

export default LogicAND;
