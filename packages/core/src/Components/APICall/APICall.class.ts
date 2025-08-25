import axios, { AxiosRequestConfig } from 'axios';
import Joi from 'joi';

import { Agent } from '@sre/AgentManager/Agent.class';
import { Component } from '../Component.class';
import { parseHeaders } from './parseHeaders';
import { parseUrl, parseSmythFsUrl, destroyPublicUrls } from './parseUrl';
import { parseData } from './parseData';
import { parseProxy } from './parseProxy';
import { parseArrayBufferResponse } from './ArrayBufferResponse.helper';
import { extractAdditionalParamsForOAuth1, handleOAuthHeaders as generateOAuthHeaders } from './OAuth.helper';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { formatDataForDebug } from '@sre/utils/data.utils';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

export class APICall extends Component {
    protected schema = {
        name: 'APICall',
        description: 'Use this component to make an API call',
        inputs: {},
        outputs: {
            Headers: {
                description: 'The headers of the API call response',
                default: true,
            },
            Response: {
                description: 'The response of the API call',
                default: true,
            },
        },
    };

    protected configSchema = Joi.object({
        method: Joi.string().valid('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS').required().label('Method'),
        url: Joi.string()
            .max(8192) /*.custom(isUrlValid, 'URL validation')*/
            .required()
            .label('URL'),
        headers: Joi.any().allow('').label('Headers'),
        contentType: Joi.string()
            .valid('none', 'application/json', 'multipart/form-data', 'binary', 'application/x-www-form-urlencoded', 'text/plain', 'application/xml')
            .label('Content-Type'),
        body: Joi.any().allow('').label('Body'),
        _templateSettings: Joi.object().allow(null).label('Template Settings'),
        _templateVars: Joi.object().allow(null).label('Template Variables'),
        proxy: Joi.string().allow('').label('Proxy'),
        oauthService: Joi.string().allow('').label('OAuth Service'),
        scope: Joi.string().allow('').label('Scope'),
        authorizationURL: Joi.string().allow('').label('Authorization URL'),
        tokenURL: Joi.string().allow('').label('Token URL'),
        clientID: Joi.string().allow('').label('Client ID'),
        clientSecret: Joi.string().allow('').label('Client Secret'),
        oauth2CallbackURL: Joi.string().allow('').label('OAuth2 Callback URL'),
        callbackURL: Joi.string().allow('').label('Callback URL'), // !TEMP: prevent validation error
        requestTokenURL: Joi.string().allow('').label('Request Token URL'),
        accessTokenURL: Joi.string().allow('').label('Access Token URL'),
        userAuthorizationURL: Joi.string().allow('').label('User Authorization URL'),
        consumerKey: Joi.string().allow('').label('Consumer Key'),
        consumerSecret: Joi.string().allow('').label('Consumer Secret'),
        oauth1CallbackURL: Joi.string().allow('').label('OAuth1 Callback URL'),
        authenticate: Joi.string().allow('').label('Authenticate'),
        oauth_con_id: Joi.string().allow('').label('OAuth Connection ID'),
    });
    constructor() {
        super();
    }

    init() { }

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config);

        let publicUrls: string[] = [];

        try {
            logger.debug(`=== API Call Log ===`);

            const method = config?.data?.method || 'get';

            const reqConfig: AxiosRequestConfig = {};
            reqConfig.method = method;

            reqConfig.url = await parseUrl(input, config, agent);

            // We generate public URLs for any resources specified with the smythfs protocol in the request URL.
            ({ url: reqConfig.url, publicUrls } = await parseSmythFsUrl(reqConfig.url, agent));

            const { data, headers } = await parseData(input, config, agent);

            // If the data is null, the request may fail. We encountered an issue where a request failed due to null data being provided.
            let dataForDebug;
            if (data) {
                reqConfig.data = data;

                dataForDebug = await formatDataForDebug(data, AccessCandidate.agent(agent.id));
            }

            reqConfig.headers = (await parseHeaders(input, config, agent)).concat({ ...headers });

            const proxyConfig = await parseProxy(input, config, agent);

            if (proxyConfig) {
                if (proxyConfig instanceof SocksProxyAgent) {
                    const isSecureEndpoint = reqConfig.url?.startsWith('https://');
                    reqConfig[isSecureEndpoint ? 'httpsAgent' : 'httpAgent'] = proxyConfig;
                } else {
                    reqConfig.proxy = proxyConfig;
                }
            }

            let Response: any = {};
            let Headers: any = {};
            let _error: any = undefined;
            try {
                if (config?.data?.oauth_con_id !== '' && config?.data?.oauth_con_id !== 'None') {
                    const additionalParams = extractAdditionalParamsForOAuth1(reqConfig);
                    const oauthHeaders = await generateOAuthHeaders(agent, config, reqConfig, logger, additionalParams);
                    //reqConfig.headers = { ...reqConfig.headers, ...oauthHeaders };
                    reqConfig.headers = reqConfig.headers.concat({ ...oauthHeaders });
                }

                // in order to handle binary data automatically, we need to set responseType to 'arraybuffer' for all requests, then parse the response data based on content-type
                reqConfig.responseType = 'arraybuffer';

                logger.debug('Making API call', { ...reqConfig, data: dataForDebug });

                const response = await axios.request(reqConfig);

                const parsedRes = await parseArrayBufferResponse(response, agent);

                // log response headers
                logger.debug('API call Response Headers', response.headers);
                Response = parsedRes;

                logger.debug('API call Response\n', Response);

                Headers = Object.fromEntries(Object.entries(response.headers));
            } catch (error) {
                logger.debug(`Error making API call: ${error.message}`);
                Headers = error?.response?.headers ? Object.fromEntries(Object.entries(error.response.headers)) : {};
                Response = await parseArrayBufferResponse(error.response, agent);
                _error = error.message;
            }

            return { Response, Headers, _error, _debug: logger.output };
        } catch (error) {
            return { _error: error.message, _debug: logger.output };
        } finally {
            if (publicUrls.length > 0) {
                await destroyPublicUrls(publicUrls);
            }
        }
    }
}
