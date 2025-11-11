import { IAgent as Agent } from '@sre/types/Agent.types';
import { Component } from './Component.class';
import Joi from 'joi';
import SREConfig from '@sre/config';
import axios from 'axios';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { AccessCandidate } from '../subsystems/Security/AccessControl/AccessCandidate.class';
import { getCredentials } from '../subsystems/Security/Credentials.helper';
// const CREDITS_PER_URL = 0.2;

export class ScrapflyWebScrape extends Component {
    protected schema = {
        name: 'ScrapflyWebScrape',
        description: 'Use this component to scrape web pages',
        inputs: {
            URLs: {
                type: 'Array',
                description: 'The URLs to scrape',
                default: true,
            },
        },
        outputs: {
            Results: {
                type: 'Array',
                description: 'The scraped results',
                default: true,
            },
            FailedURLs: {
                type: 'Array',
                description: 'The URLs that failed to scrape',
                default: true,
            },
        },
    };

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

            // Filter inputs to include only the fields defined in the component's configuration.
            // This prevents URLs from global variables from being scraped.
            const componentInputNames = new Set(config.inputs.map((input) => input.name));
            const filteredInput = Object.fromEntries(Object.entries(input).filter(([key]) => componentInputNames.has(key)));

            const scrapeUrls = this.extractUrls(filteredInput);

            logger.debug('Payload:', JSON.stringify(config.data));
            logger.debug(`Vaild URLs: ${JSON.stringify(scrapeUrls)}`);
            const teamId = agent.teamId;
            const key = await getCredentials(AccessCandidate.team(teamId), 'scrapfly');

            const scrapeResults = await Promise.all(scrapeUrls.map((url) => this.scrapeURL(url, config.data, key)));
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

    async scrapeURL(url, data, key) {
        try {
            const response = await axios({
                method: 'get',
                url: 'https://api.scrapfly.io/scrape',
                params: {
                    url: encodeURIComponent(url),
                    key,
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
