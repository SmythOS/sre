import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';
import Joi from 'joi';
import SREConfig from '@sre/config';
import axios from 'axios';


export default class WebSearch extends Component {
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
    init() { }
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config.name);
        try {
            logger.debug(`=== Web Scrape Log ===`);
            let Output: any = {};
            let _error = undefined;
            let searchQuery = input['SearchQuery'];
            logger.debug(config.data);
            const response = await axios({
                method: 'post',
                url: 'https://api.tavily.com/search',
                data: {
                    api_key: SREConfig.env.TAVILY_API_KEY,
                    query: searchQuery,
                    topic: config.data.searchTopic,
                    exclude_domains: config.data.excludeDomains?.split(','),
                    time_range: config.data.timeRange,
                    max_results: config.data.sourcesLimit,
                    ...(config.includeImages ? { include_images: true } : {}),
                    ...(config.data.includeQAs ? { include_answer: true } : {}),
                    ...(config.data.includeRawContent ? { include_raw_content: true } : {}),

                }
            });
            logger.debug(JSON.stringify(response.data));
            Output = { results: response.data.results };
            return { ...Output, _error, _debug: logger.output };
        } catch (err: any) {
            const _error = err?.response?.data || err?.message || err.toString();
            logger.error(` Error scraping web \n${JSON.stringify(_error)}\n`);
            return { Output: undefined, _error, _debug: logger.output };
        }
    }

}