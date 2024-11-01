import config from '../config';
import axios from 'axios';
import { getM2MToken } from './logto-helper';
import { includeAuth, mwSysAPI } from './smythAPIReq';

import { createLogger } from './logger';
import { ConnectorService } from '../../../../src';
const console = createLogger('___FILENAME___');

export function extractAgentVerionsAndPath(url) {
    const regex = /^\/v(\d+(\.\d+)?)?(\/api\/.+)/;
    const match = url.match(regex);

    if (match) {
        return {
            path: match[3],
            version: match[1] || '',
        };
    } else {
        return {
            path: url,
            version: '',
        };
    }
}

export async function getAgentDomainById(agentId: string) {
    const token = (await getM2MToken('https://api.smyth.ai')) as string;
    const agentDataConnector = ConnectorService.getAgentDataConnector();

    const Authorization = `Bearer ${token}`;

    //TODO : OPTIMIZE THIS : use aiAgentId param instead of getting all domains then filtering
    const result: any = await mwSysAPI.get('/domains?verified=true', { headers: { Authorization } }).catch((error) => ({ error }));

    if (result.error) {
        throw new Error('Error getting domain info');
    }

    const domain = result.data.domains.find((domainEntry: any) => domainEntry?.aiAgent?.id === agentId)?.name;

    if (!domain) {
        const deployed = await agentDataConnector.isDeployed(agentId);
        if (deployed) {
            return `${agentId}.${config.env.PROD_AGENT_DOMAIN}`;
        }
    }
    return domain;
}

export async function readAgentOAuthConfig(agentData) {
    const authInfo = agentData?.auth;
    const method = authInfo?.method;
    const provider = authInfo?.provider[authInfo?.method];
    if (!provider) {
        return {};
    }
    const authOIDCConfigURL = provider.OIDCConfigURL;
    const clientID = provider.clientID;
    const clientSecret = provider.clientSecret;
    const openid: any = await axios.get(authOIDCConfigURL).catch((error) => ({ error }));

    const tokenURL = openid?.data?.token_endpoint;
    const authorizationURL = openid?.data?.authorization_endpoint;

    return { authorizationURL, tokenURL, clientID, clientSecret, method, provider };
}
