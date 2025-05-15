import Component from './Component.class';
import { Agent } from '@sre/AgentManager/Agent.class';

export class FEncDec extends Component {
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);
        try {
            const _error = undefined;

            const data = input.Data;
            const action = config.data.action || 'Encode';
            const encoding = config.data.encoding;
            logger.debug(`${encoding} ${action} data`);

            const Output = action == 'Encode' ? Buffer.from(data).toString(encoding) : Buffer.from(data, encoding).toString('utf8');

            return { Output, _error, _debug: logger.output };
        } catch (err: any) {
            const _error = err?.response?.data || err?.message || err.toString();
            logger.error(` Error processing data \n${_error}\n`);
            return { hash: undefined, _error, _debug: logger.output };
        }
    }
}

export default FEncDec;
