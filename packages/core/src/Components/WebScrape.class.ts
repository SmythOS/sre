import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';
import Joi from 'joi';
import SREConfig from '@sre/config';
import axios from 'axios';
import SystemEvents from '@sre/Core/SystemEvents';
// const CREDITS_PER_URL = 0.2;

export class WebScrape extends Component {
    protected configSchema = Joi.object({
        // includeImages: Joi.boolean().default(false).label('Include Image Results'),
        antiScrapingProtection: Joi.boolean().default(false).label('Enable Anti-Scraping Protection'),
        javascriptRendering: Joi.boolean().default(false).label('Enable JavaScript Rendering'),
        autoScroll: Joi.boolean().default(false).label('Enable Auto Scroll'),
        format: Joi.string().default('markdown').label('Format').optional(),
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
            const scrapeUrls = this.extractUrls(input);
            logger.debug('Payload:', JSON.stringify(config.data));
            logger.debug(`Vaild URLs: ${JSON.stringify(scrapeUrls)}`);

            const scrapeResults = await Promise.all(scrapeUrls.map((url) => this.scrapeURL(url, config.data)));
            const results = scrapeResults
                .filter((result) => result.success)
                .map((result) => {
                    return { url: result.url, content: result.content };
                });
            const failedResults = scrapeResults
                .filter((result) => !result.success)
                .map((result) => {
                    return { url: result.url, error: result.error };
                });

            Output = { Results: results, FailedURLs: failedResults };
            const totalCredits = scrapeResults.reduce((acc, result) => acc + (result.cost || 0), 0);
            this.reportUsage({
                urlsScraped: results?.length,
                agentId: agent.id,
                teamId: agent.teamId,
                totalCredits,
            });
            return { ...Output, _error, _debug: logger.output };
        } catch (err: any) {
            const _error = err?.message || err?.response?.data || err.toString();
            logger.error(` Error scraping web \n${_error}\n`);
            return { Output: undefined, _error, _debug: logger.output };
        }
    }

    async scrapeURL(url, data) {
        try {
            const response = await axios({
                method: 'get',
                url: 'https://api.scrapfly.io/scrape',
                params: {
                    url: encodeURIComponent(url),
                    key: SREConfig.env.SCRAPFLY_API_KEY,
                    cost_budget: 80,
                    ...(data.format ? { format: data.format } : { format: 'markdown' }),
                    ...(data.antiScrapingProtection && { asp: true }),
                    ...(data.javascriptRendering && { render_js: true }),
                    ...(data.autoScroll && { auto_scroll: true, render_js: true }),
                },
            });
            return {
                content: response.data?.result?.content,
                success: true,
                url,
                cost: response.data?.context?.cost?.total || 0,
            };
        } catch (error) {
            return {
                content: undefined,
                success: false,
                error: error?.response?.data?.result?.error?.message || 'Failed to scrape URL',
                url,
                cost: 0,
            };
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

    protected reportUsage({
        urlsScraped,
        agentId,
        teamId,
        totalCredits,
    }: {
        urlsScraped: number;
        agentId: string;
        teamId: string;
        totalCredits: number;
    }) {
        SystemEvents.emit('USAGE:API', {
            sourceId: 'api:webscrape.smyth',
            credits: totalCredits,
            agentId,
            teamId,
        });
    }
}

export default WebScrape;
