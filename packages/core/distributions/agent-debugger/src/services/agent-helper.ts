import config from '../config';
import axios from 'axios';
import { getM2MToken } from './logto-helper';
import { includeAuth, mwSysAPI } from './smythAPIReq';

import { createLogger } from './logger';
const console = createLogger('___FILENAME___');
// const DB_CRUD_ENDPOINT_PREFIX = config.env.SMYTH_API_BASE_URL;

// //* NEW DB INTEGRATION INSTEAD OF FILE SYSTEM

// const axiosInstance = axios.create({
//     baseURL: `${DB_CRUD_ENDPOINT_PREFIX}/v1`,
// });

//TODO : cache versioned agent data. when an agent has a version, the data does not change, we can keep it in cache to avoid calling the api every time
export async function getAgentDataById(agentID, version) {
    console.log('getAgentDataById', agentID, version);
    try {
        const token = (await getM2MToken('https://api.smyth.ai')) as string;

        let agentObj;

        //FIXME : once we have the agent name in deployment api response, we can skip this call
        const response = await mwSysAPI.get(`/ai-agent/${agentID}?include=team.subscription`, includeAuth(token));
        agentObj = response.data.agent;
        const authData = agentObj.data.auth; //use most up to date auth data

        const tasksResponse = await mwSysAPI.get(`/quota/team/${agentObj.teamId}/tasks/subscription`, includeAuth(token));
        agentObj.taskData = tasksResponse.data;

        agentObj.data.debugSessionEnabled = agentObj?.data?.debugSessionEnabled && agentObj?.isLocked; //disable debug session if agent is not locked (locked agent means that it's open in the Agent builder)

        if (version) {
            const deploymentsList = await mwSysAPI.get(`/ai-agent/${agentID}/deployments`, includeAuth(token));
            const deployment =
                version == 'latest'
                    ? deploymentsList?.data?.deployments[0]
                    : deploymentsList?.data?.deployments?.find((deployment) => deployment.version === version);
            if (deployment) {
                const deployResponse = await mwSysAPI.get(`/ai-agent/deployments/${deployment.id}`, includeAuth(token));
                agentObj.data = deployResponse?.data?.deployment?.aiAgentData;
                agentObj.data.debugSessionEnabled = false; //never enable debug session when using a deployed version
                agentObj.data.agentVersion = deployment.version;
            } else {
                //if (version !== 'latest') {
                throw new Error(`Requested Deploy Version not found: ${version}`);
                //} // if version == 'latest' but no deployment is found we just fallback to the agent live data
            }
        }

        //TODO: Also include team and subscription info

        //agentObj.data.auth = authData;
        if (!agentObj?.data?.auth?.method || agentObj?.data?.auth?.method == 'none') agentObj.data.auth = authData;

        agentObj.data = migrateAgentData(agentObj.data);

        return agentObj;
    } catch (error: any) {
        console.error(error.response?.data, error.message);
        console.log(`Error getting agent data for agentId=${agentID}: ${error?.message}`);
        throw new Error(`Error getting agent data for agentId=${agentID}: ${error?.message}`);
    }
}

export async function isDeployed(agentID) {
    try {
        const token = (await getM2MToken('https://api.smyth.ai')) as string;
        const deploymentsList = await mwSysAPI.get(`/ai-agent/${agentID}/deployments`, includeAuth(token));
        return deploymentsList?.data?.deployments?.length > 0;
    } catch (error) {
        console.error(error);
        return false;
    }
}

export async function getAgentEmbodiments(agentID) {
    try {
        const token = (await getM2MToken('https://api.smyth.ai')) as string;
        const url = `${config.env.SMYTH_API_BASE_URL}/_sysapi/v1/embodiments?aiAgentId=${agentID}`;
        console.log('calling URL', url);

        const response = await axios.get(`${config.env.SMYTH_API_BASE_URL}/_sysapi/v1/embodiments?aiAgentId=${agentID}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        // }
        // const response = await smythAPIReq.get(`/embodiments?aiAgentId=${agentID}`, includeAuth(token));

        return response.data.embodiments;
    } catch (error: any) {
        console.error(error.response?.data, error.message);
        console.log(`Error getting embodiments for agentId=${agentID}: ${error?.message}`);
        throw new Error(`Error getting embodiments for agentId=${agentID}: ${error?.message}`);

        ///throw error;
    }
}

function migrateAgentData(data) {
    if (!data.version) {
        console.log(`Agent [${data.name}] has an old schema. Migrating to latest version...`);
        // version 0  ===> migrate from receptors/connectors to inputs/outputs
        const newData = JSON.parse(JSON.stringify(data));
        for (let component of newData.components) {
            component.outputs = component.connectors;
            component.inputs = component.receptors;
            component.outputProps = component.connectorProps;
            component.inputProps = component.receptorProps;
            delete component.connectors;
            delete component.receptors;
            delete component.connectorProps;
            delete component.receptorProps;
        }
        return newData;
    }

    if (data.version === '1.0.0') {
        //migrate .description to .behavior
        if (data.description && !data.behavior) {
            data.behavior = data.description;
            //delete newConfig.description;
        }
    }

    return data;
}

export async function getAgentDataByDomain(domain, method, endpointPath) {
    try {
        //first check if this is the internal wildcard agents domain
        if (domain.includes(config.env.AGENT_DOMAIN)) {
            //console.log('Internal agent domain detected', domain);
            const agentId = domain.split('.')[0];
            //sanity check
            if (`${agentId}.${config.env.AGENT_DOMAIN}` !== domain) {
                throw new Error(`Invalid agent domain: ${domain}`);
            }
            // const agent = await getAgentDataById(agentId);
            // if (!agent) {
            //     throw new Error(`Agent not found: ${agentId}`);
            // }
            const agent = { id: agentId };
            return agent;
        }

        const token = (await getM2MToken('https://api.smyth.ai')) as string;
        //TODO : remove method and endpointPath since we only rely on domain now
        const response = await mwSysAPI.get(`/ai-agent?domainName=${domain}&method=${method}&endpointPath=${endpointPath}`, includeAuth(token));
        console.log(response.data);
        return response.data.agent;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

// export async function getAgendIdByDomain(domain) {
//     try {
//         const token = (await getM2MToken('https://api.smyth.ai')) as string;

//         const response = await smythAPIReq.post(
//             '/domain/query',
//             {
//                 name: domain,
//             },
//             includeAuth(token),
//         );
//         return response.data.domain;
//     } catch (error) {
//         console.error(error);
//         throw error;
//     }
// } // DONE (NOT TESTED)

export async function getAgentIdByDomain(domain) {
    let agentId;
    //first check if this is the internal wildcard agents domain
    const isStageWildcardDomain = domain.includes(config.env.AGENT_DOMAIN);
    const isProdWildcardDomain = domain.includes(config.env.PROD_AGENT_DOMAIN);
    if (isStageWildcardDomain || isProdWildcardDomain) {
        //console.log('Internal agent domain detected', domain);
        agentId = domain.split('.')[0];
        //sanity check
        if (`${agentId}.${config.env.AGENT_DOMAIN}` !== domain && `${agentId}.${config.env.PROD_AGENT_DOMAIN}` !== domain) {
            throw new Error(`Invalid agent domain: ${domain}`);
        }

        //if this is a stage domain, no more check, return the agentId
        if (isStageWildcardDomain) return agentId;
    }

    const token = (await getM2MToken('https://api.smyth.ai')) as string;
    const Authorization = `Bearer ${token}`;
    //FIXME : filter domains by agentId and by domain Id once it's supported in the middleware
    const result: any = await mwSysAPI.get('/domains?verified=true', { headers: { Authorization } }).catch((error) => ({ error }));

    if (result.error) {
        throw new Error('Error getting domain info');
    }

    //we have an agentId from the wildcard domain, if this domain is already associated with
    if (agentId) {
        const hasDomain = result.data.domains.find((domainEntry: any) => domainEntry?.aiAgent?.id === agentId);
        if (hasDomain) {
            throw new Error('Wrong domain');
        }
    } else {
        agentId = result.data.domains.find((domainEntry: any) => domainEntry.name === domain)?.aiAgent?.id;
    }

    //if a custom domain is found, use it, otherwise use the agentId from the wildcard domain

    return agentId;
}

// Optimization: Better approach could be to get agent domain by ID - include the domain info in this endpoint - `/ai-agent/${agentID}`, or register a dedicated endpoint that allow direct retrieval
export async function getAgentDomainById(agentId: string) {
    const token = (await getM2MToken('https://api.smyth.ai')) as string;
    const Authorization = `Bearer ${token}`;

    //TODO : OPTIMIZE THIS : use aiAgentId param instead of getting all domains then filtering
    const result: any = await mwSysAPI.get('/domains?verified=true', { headers: { Authorization } }).catch((error) => ({ error }));

    if (result.error) {
        throw new Error('Error getting domain info');
    }

    const domain = result.data.domains.find((domainEntry: any) => domainEntry?.aiAgent?.id === agentId)?.name;

    if (!domain) {
        const deployed = await isDeployed(agentId);
        if (deployed) {
            return `${agentId}.${config.env.PROD_AGENT_DOMAIN}`;
        }
    }
    return domain;
}

export async function getAgentSettings(agentID) {
    try {
        const token = (await getM2MToken('https://api.smyth.ai')) as string;

        const response = await mwSysAPI.get(`/ai-agent/${agentID}/settings`, includeAuth(token));

        const settings = response.data.settings;
        return settings;
    } catch (error) {
        //console.warn(error);
        return [];
    }
}

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
