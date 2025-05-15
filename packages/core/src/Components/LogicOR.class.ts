import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';

export class LogicOR extends Component {
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const result: any = { Output: undefined };
        console.log(input);
        console.log(config);
        for (let cfgInput of config.inputs) {
            // check if one of the inputs are set (expected inputs are in "config.inputs" actual inputs are in "input")
            if (input[cfgInput.name]) {
                result.Output = true;
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

export default LogicOR;
