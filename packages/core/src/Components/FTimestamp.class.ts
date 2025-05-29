import { Component } from './Component.class';
import { IAgent as Agent } from '@sre/types/Agent.types';

export class FTimestamp extends Component {
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);
        try {
            const _error = undefined;
            const format = config.data.format; //TODO set timestamp format
            const Timestamp = Date.now();
            logger.debug(`Timestamp : ${Timestamp}`);

            return { Timestamp, _error, _debug: logger.output, _debug_time: logger.elapsedTime };
        } catch (err: any) {
            const _error = err?.response?.data || err?.message || err.toString();
            logger.error(` Error processing data \n${_error}\n`);
            return { hash: undefined, _error, _debug: logger.output, _debug_time: logger.elapsedTime };
        }
    }
}
