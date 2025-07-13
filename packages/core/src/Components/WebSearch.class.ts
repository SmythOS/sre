import axios from 'axios';
import Joi from 'joi';
import { Component } from './Component.class';
import { IAgent as Agent } from '@sre/types/Agent.types';

export class WebSearch extends Component {
    protected schema = {
        name: 'WebSearch',
        description: 'Use this component to perform a web search',
        inputs: {
            SearchQuery: {
                type: 'Text',
                description: 'The search query',
                default: true,
            },
        },
        outputs: {
            Results: {
                description: 'The search results',
                default: true,
            },
        },
    };

    protected configSchema = Joi.object({
        url: Joi.string().uri().default('https://api.duckduckgo.com/').label('URL'),
        method: Joi.string().valid('GET', 'POST').default('GET').label('Method'),
        headers: Joi.any().optional().label('Headers'),
        body: Joi.any().optional().label('Body'),
        query: Joi.any().optional().label('Query'),
        queryParam: Joi.string().default('q').label('Query Param Name'),
        format: Joi.string().default('json').label('Format'),
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
            const params: any = { ...(config?.data?.query || {}) };
            const data = config?.data?.body;
            const queryParam = config?.data?.queryParam || 'q';
            const format = config?.data?.format || 'json';

            if (input?.SearchQuery) {
                params[queryParam] = input.SearchQuery;
            }
            if (format) {
                params.format = format;
            }

            logger.debug('WebSearch request', { method, url, headers, params, data });

            const response = await axios({ method, url, headers, params, data });

            return {
                Results: response.data,
                Headers: response.headers,
                Status: response.status,
                _error: undefined,
                _debug: logger.output,
            };
        } catch (err: any) {
            logger.error('WebSearch failed', err.message);
            return {
                Results: err?.response?.data,
                Headers: err?.response?.headers,
                Status: err?.response?.status,
                _error: err?.message || err.toString(),
                _debug: logger.output,
            };
        }
    }
}
