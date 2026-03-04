import { Component } from './Component.class';
import { IAgent as Agent } from '@sre/types/Agent.types';
import Joi from 'joi';
import dayjs from 'dayjs';

export class FTimestamp extends Component {
    protected configSchema = Joi.object({
        format: Joi.alternatives()
            .try(Joi.string().valid('unix', 'iso', 'timestamp'), Joi.string().pattern(/^[YMDHhmsSSZzAa\s\-\/:,\.]*$/, 'custom dayjs format'))
            .default('unix')
            .allow(null)
            .label('Timestamp Format')
            .messages({
                'string.pattern.name': 'Invalid format string: {#value}',
            }),
    });

    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config);

        const validationResult = await this.validateConfig(config);
        if (validationResult._error) {
            return {
                Timestamp: undefined,
                _error: validationResult._error,
                _debug: logger.output,
                _debug_time: logger.elapsedTime,
            };
        }
        try {
            const _error = undefined;
            const format = config.data.format || 'unix';
            const now = dayjs();

            let Timestamp: number | string;

            switch (format) {
                case 'unix':
                case 'timestamp':
                    Timestamp = Date.now();
                    logger.debug(`Unix timestamp: ${Timestamp}`);
                    break;
                case 'iso':
                    Timestamp = now.toISOString();
                    logger.debug(`ISO timestamp: ${Timestamp}`);
                    break;
                default:
                    Timestamp = now.format(format);
                    logger.debug(`Custom formatted timestamp (${format}): ${Timestamp}`);
                    break;
            }

            return { Timestamp, _error, _debug: logger.output, _debug_time: logger.elapsedTime };
        } catch (err: any) {
            const _error = err?.response?.data || err?.message || err.toString();
            logger.error(` Error processing timestamp \n${_error}\n`);
            return { Timestamp: undefined, _error, _debug: logger.output, _debug_time: logger.elapsedTime };
        }
    }
}
