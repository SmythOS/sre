import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';
import Joi from 'joi';
import SREConfig from '@sre/config';
import axios from 'axios';
import SystemEvents from '@sre/Core/SystemEvents';
const CREDITS_PER_URL = 0.2;

export default class WebScrape extends Component {
    protected configSchema = Joi.object({
        includeImages: Joi.boolean().default(false).label('Include Image Results'),
    });

    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config.name);
        try {
            logger.debug(`=== Web Scrape Log ===`);
            let Output: any = {};
            let _error = undefined;
            const scrapeUrls = this.extractUrls(input);
            logger.debug('Payload:', JSON.stringify(config.data));
            logger.debug(`Vaild URLs: ${JSON.stringify(scrapeUrls)}`);
            const response = await axios({
                method: 'post',
                url: 'https://api.tavily.com/extract',
                data: {
                    api_key: SREConfig.env.TAVILY_API_KEY,
                    urls: scrapeUrls,
                    ...(config.data.includeImages ? { include_images: true } : {}),
                },
            });

            Output = { Results: response?.data?.results, FailedURLs: response?.data?.failed_results?.length ? response?.data?.failed_results : undefined };
            this.reportUsage({
                urlsScraped: response?.data?.results?.length,
                agentId: agent.id,
                teamId: agent.teamId,
            });
            return { ...Output, _error, _debug: logger.output };
        } catch (err: any) {
            const _error = err?.message || err?.response?.data || err.toString();
            logger.error(` Error scraping web \n${_error}\n`);
            return { Output: undefined, _error, _debug: logger.output };
        }
    }

    extractUrls(input: any) {
        const scrapeUrls = [];
        for (const key in input) {
            if (Object.prototype.hasOwnProperty.call(input, key)) {
                const inputItem = input[key];
                if (typeof inputItem === 'string') {
                    try {
                        let urls = JSON.parse(inputItem);
                        for (const url of urls) {
                            if (this.isValidUrl(url)) {
                                scrapeUrls.push(url.trim());
                            }
                        }
                    } catch (error) {
                        const commaSeparatedUrls = inputItem.split(',');
                        for (const url of commaSeparatedUrls) {
                            if (this.isValidUrl(url)) {
                                scrapeUrls.push(url.trim());
                            }
                        }
                    }
                } else if (typeof inputItem === 'object') {
                    for (const url of inputItem) {
                        if (this.isValidUrl(url)) {
                            scrapeUrls.push(url.trim());
                        }
                    }
                }
            }
        }
        return scrapeUrls;
    }

    isValidUrl(urlString: string) {
        try {
            const urlToCheck = urlString;
            new URL(urlToCheck);
            return true;
        } catch (error) {
            return false;
        }
    }

    protected reportUsage({ urlsScraped, agentId, teamId }: { urlsScraped: number; agentId: string; teamId: string }) {
        SystemEvents.emit('USAGE:API', {
            sourceId: 'api:webscrape.smyth',
            requests: urlsScraped,
            credits: CREDITS_PER_URL,
            costs: urlsScraped * CREDITS_PER_URL,
            agentId,
            teamId,
        });
    }
}
