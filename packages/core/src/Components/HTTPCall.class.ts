import axios from 'axios';
import Joi from 'joi';
import { Component } from './Component.class';
import { IAgent as Agent } from '@sre/types/Agent.types';

export class HTTPCall extends Component {
    protected configSchema = Joi.object({
        method: Joi.string()
            .valid('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS')
            .default('GET')
            .label('Method'),
        url: Joi.string().uri().required().label('URL'),
        headers: Joi.any().optional().label('Headers'),
        body: Joi.any().optional().label('Body'),
        query: Joi.any().optional().label('Query'),
    });

    constructor() {
        super();
    }

    init() {}

    async process(input: any, config: any, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config);
        try {
            const method = (config?.data?.method || 'GET').toLowerCase();
            const url = config?.data?.url;
            const headers = config?.data?.headers || {};
            const data = config?.data?.body;
            const params = config?.data?.query;

            logger.debug('HTTP Call request', { method, url, headers, params, data });

            const response = await axios({ method, url, headers, params, data });

            return {
                Response: response.data,
                Headers: response.headers,
                Status: response.status,
                _error: undefined,
                _debug: logger.output,
            };
        } catch (err: any) {
            logger.error('HTTP Call failed', err.message);
            return {
                Response: err?.response?.data,
                Headers: err?.response?.headers,
                Status: err?.response?.status,
                _error: err?.message || err.toString(),
                _debug: logger.output,
            };
        }
    }
}
