import Component from './Component.class';
import Agent from '@sre/AgentManager/Agent.class';

export default class FSleep extends Component {
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);
        try {
            const _error = undefined;
            const delay = parseInt(config.data.delay || 1);
            const Output = input.Input;
            logger.debug(`Sleeping for ${delay} seconds`);
            await new Promise((resolve) => setTimeout(resolve, delay * 1000));
            return { Output, _error, _debug: logger.output, _debug_time: logger.elapsedTime };
        } catch (err: any) {
            const _error = err?.response?.data || err?.message || err.toString();
            logger.error(` Error processing data \n${_error}\n`);
            return { hash: undefined, _error, _debug: logger.output, _debug_time: logger.elapsedTime };
        }
    }
}
