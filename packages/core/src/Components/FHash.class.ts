import { Component } from './Component.class';
import { IAgent as Agent } from '@sre/types/Agent.types';
import crypto from 'crypto';

export class FHash extends Component {
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
            const algorithm = config.data.algorithm;
            const encoding = config.data.encoding;
            logger.debug(` Generating hash using ${algorithm} algorithm and ${encoding} encoding`);

            const hashAlgo = crypto.createHash(algorithm);
            hashAlgo.update(data);

            const Hash = hashAlgo.digest(encoding);
            logger.debug(` Generated hash: ${Hash}`);
            return { Hash, _error, _debug: logger.output };
        } catch (err: any) {
            const _error = err?.response?.data || err?.message || err.toString();
            logger.error(` Error generating hash \n${_error}\n`);
            return { hash: undefined, _error, _debug: logger.output };
        }
    }
}
