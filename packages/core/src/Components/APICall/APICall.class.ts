import axios, { AxiosRequestConfig } from 'axios';
import Joi from 'joi';

import Agent from '@sre/AgentManager/Agent.class';
import Component from '../Component.class';
import { REQUEST_CONTENT_TYPES } from '@sre/constants';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { parseHeaders } from './parseHeaders';
import { parseUrl } from './parseUrl';
import { parseData } from './parseData';
import { parseProxy } from './parseProxy';
import { parseArrayBufferResponse } from './ArrayBufferResponse.helper';
import { extractAdditionalParamsForOAuth1, handleOAuthHeaders as generateOAuthHeaders } from './OAuth.helper';

export default class APICall extends Component {
    protected configSchema = Joi.object({
        method: Joi.string().valid('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS').required().label('Method'),
        url: Joi.string()
            .max(8192) /*.custom(isUrlValid, 'URL validation')*/
            .required()
            .label('URL'),
        headers: Joi.string().allow('').label('Headers'),
        contentType: Joi.string()
            .valid('none', 'application/json', 'multipart/form-data', 'binary', 'application/x-www-form-urlencoded', 'text/plain', 'application/xml')
            .label('Content-Type'),
        body: Joi.string().allow('').label('Body'),
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
    });
    constructor() {
        super();
    }

    init() {}

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config.name);

        try {
            logger.debug(`=== API Call Log ===`);

            const method = config?.data?.method || 'get';

            const reqConfig: AxiosRequestConfig = {};
            reqConfig.method = method;

            reqConfig.url = await parseUrl(input, config, agent);

            const { data, headers } = await parseData(input, config, agent);

            reqConfig.data = data;

            reqConfig.headers = (await parseHeaders(input, config, agent)).concat({ ...headers });

            reqConfig.proxy = await parseProxy(input, config, agent);

            let Response: any = {};
            let Headers: any = {};
            let _error: any = undefined;
            try {
                if (config?.data?.oauthService !== '' && config?.data?.oauthService !== 'None') {
                    const rootUrl = new URL(reqConfig.url).origin;
                    const additionalParams = extractAdditionalParamsForOAuth1(reqConfig);
                    const oauthHeaders = await generateOAuthHeaders(agent, config, reqConfig, logger, additionalParams, rootUrl);
                    //reqConfig.headers = { ...reqConfig.headers, ...oauthHeaders };
                    reqConfig.headers = reqConfig.headers.concat({ ...oauthHeaders });
                }

                logger.debug('Making API call', reqConfig);
                // in order to handle binary data automatically, we need to set responseType to 'arraybuffer' for all requests, then parse the response data based on content-type
                reqConfig.responseType = 'arraybuffer';

                const response = await axios.request(reqConfig);

                Response = await parseArrayBufferResponse(response, agent);
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
        }
    }
}
