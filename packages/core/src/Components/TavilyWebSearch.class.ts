import { IAgent as Agent } from '@sre/types/Agent.types';
import { Component } from './Component.class';
import Joi from 'joi';
import SREConfig from '@sre/config';
import axios from 'axios';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { getCredentials } from '../subsystems/Security/Credentials.helper';
import { AccessCandidate } from '../subsystems/Security/AccessControl/AccessCandidate.class';

export class TavilyWebSearch extends Component {
    protected schema = {
        name: 'TavilyWebSearch',
        description: 'Use this component to generate a responses from an LLM',

        inputs: {
            SearchQuery: {
                type: 'Text',
                description: 'The search query to get the web search results of',
                default: true,
            },
        },
        outputs: {
            Results: {
                type: 'Array',
                description: 'The web search results',
                default: true,
            },
        },
    };

    protected configSchema = Joi.object({
        includeImages: Joi.boolean().default(false).label('Include Image Results'),
        sourcesLimit: Joi.number().integer().default(10).label('Sources Limit'),
        searchTopic: Joi.string().valid('general', 'news').label('Search Topic'),
        includeQAs: Joi.boolean().default(false).label('Include QAs'),
        timeRange: Joi.string().valid('None', 'day', 'week', 'month', 'year').label('Time Range'),
        includeRawContent: Joi.boolean().default(false).label('Include Raw Content'),
        excludeDomains: Joi.string().allow('').label('Exclude Domains'),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config);
        try {
            logger.debug(`=== Web Scrape Log ===`);
            let Output: any = {};
            let _error = undefined;
            let searchQuery = input['SearchQuery'];

            const teamId = agent.teamId;
            const api_key = await getCredentials(AccessCandidate.team(teamId), 'tavily');

            logger.debug('Payload:', JSON.stringify(config.data));

            const excludeDomains = config.data.excludeDomains?.length ? config.data.excludeDomains.split(',').map((d) => d.trim()) : [];

            const response = await axios({
                method: 'post',
                url: 'https://api.tavily.com/search',
                data: {
                    api_key,
                    query: searchQuery,
                    topic: config.data.searchTopic,
                    exclude_domains: excludeDomains,
                    max_results: config.data.sourcesLimit,
                    ...(config.data.timeRange !== 'None' ? { time_range: config.data.timeRange } : {}),
                    ...(config.data.includeImages ? { include_images: true } : {}),
                    ...(config.data.includeQAs ? { include_answer: true } : {}),
                    ...(config.data.includeRawContent ? { include_raw_content: true } : {}),
                },
            });
            Output = {
                Results: response.data.results,
                ...(config.data.includeImages ? { Images: response.data.images } : {}),
                ...(config.data.includeQAs ? { Answer: response.data.answer } : {}),
            };
            this.reportUsage({
                agentId: agent.id,
                teamId: agent.teamId,
            });
            return { ...Output, _error, _debug: logger.output };
        } catch (err: any) {
            const _error = err?.message || err?.response?.data || err.toString();

            if (err?.status === 401) {
                logger.error(`Tavily Web Search Auth failed, make sure that you have the vault key "tavily" is present and valid`);
            } else {
                logger.error(` Error scraping web \n${JSON.stringify(_error)}\n`);
            }
            return { Output: undefined, _error, _debug: logger.output };
        }
    }

    protected reportUsage({ agentId, teamId }: { agentId: string; teamId: string }) {
        SystemEvents.emit('USAGE:API', {
            sourceId: 'api:websearch.smyth',
            credits: 1,
            agentId,
            teamId,
        });
    }
}
