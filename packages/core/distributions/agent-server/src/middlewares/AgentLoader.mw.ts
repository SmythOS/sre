import { extractAgentVerionsAndPath, getAgentDomainById } from '../services/agent-helper';
import config from '../config';

import { createLogger } from '../services/logger';
import { ConnectorService } from '../../../../src';
const console = createLogger('___FILENAME___');

export default async function AgentLoader(req, res, next) {
    console.log('AgentLoader', req.path);
    const agentDataConnector = ConnectorService.getAgentDataConnector();

    if (req.path.startsWith('/static/')) {
        return next();
    }
    let agentId = req.header('X-AGENT-ID');
    let agentVersion = req.header('X-AGENT-VERSION') || '';

    let agentDomain: any = '';
    let isTestDomain = false;
    let { path, version } = extractAgentVerionsAndPath(req.path);
    if (!version) version = agentVersion;
    if (!agentId) {
        const domain = req.hostname;
        const method = req.method;

        agentId = await agentDataConnector.getAgentIdByDomain(domain).catch((error) => {
            console.error(error);
        });
        agentDomain = domain;
        if (agentId && domain.includes(config.env.AGENT_DOMAIN)) {
            isTestDomain = true;
        }
    }
    if (agentId) {
        if (!isTestDomain && agentId && req.hostname.includes('localhost')) {
            console.log(`Agent is running on localhost (${req.hostname}), assuming test domain`);
            isTestDomain = true;
        }
        if (agentDomain && !isTestDomain && !version) {
            //when using a production domain but no version is specified, use latest
            version = 'latest';
        }

        const agentData = await agentDataConnector.getAgentData(agentId, version).catch((error) => {
            console.error(error);
            return { error: error.message };
        });
        if (agentData?.error) {
            // return Not found error for storage requests
            if (req.path.startsWith('/storage/')) {
                return res.status(404).send(`File Not Found`);
            }
            return res.status(500).send({ error: agentData.error });
        }

        // clean up agent data
        cleanAgentData(agentData);

        req._plan = parsePlanData(agentData);

        req._agent = agentData.data;
        req._agent.planInfo = req._plan || {
            planId: undefined,
            planName: undefined,
            isFreePlan: true,
            tasksQuota: 0,
            usedTasks: 0,
            remainingTasks: 0,
            maxLatency: 100,
        };

        req._agent.usingTestDomain = isTestDomain;
        req._agent.domain = agentDomain || (await getAgentDomainById(agentId));
        //req._agent.version = version;
        //req._data1 = 1;

        console.log(` Loaded Agent:${agentId} v=${version} path=${path} isTestDomain=${isTestDomain} domain=${agentDomain}`);
        return next();
    }

    return res.status(404).send({ error: `${req.path} Not Found` });
}
function parsePlanData(agentData) {
    // free plans cannot register a domain
    //FIXME : this check is probably weak, we need to make sure that it's always accurate or implement a better way to check.
    const planId = agentData?.team?.subscription?.plan?.id;
    const planName = agentData?.team?.subscription?.plan?.name;
    const isFreePlan = !agentData?.team?.subscription?.plan?.properties?.flags?.domainRegistrationEnabled;
    let tasksQuota = (agentData?.team?.subscription?.properties?.tasks || 0) + (agentData?.team?.subscription?.properties?.bonusTasks || 0);
    //exception for early adopters
    tasksQuota = agentData?.team?.subscription?.plan?.name == 'Early Adopters' ? Infinity : tasksQuota;

    let usedTasks = agentData.taskData.tasks;
    let remainingTasks = Math.max(tasksQuota - usedTasks, 0);
    // apply latency to free plans with no paid tasks in order to preserve resources
    const maxLatency = isFreePlan && remainingTasks <= 0 ? config.env.MAX_LATENCY_FREE_USER : config.env.MAX_LATENCY_PAID_USER;
    const maxParellelRequests = isFreePlan && remainingTasks <= 0 ? 1 : Infinity;
    return {
        planId,
        planName,
        isFreePlan,
        tasksQuota,
        usedTasks,
        remainingTasks,
        maxLatency,
        maxParellelRequests,
    };
}
// clean up agent data
function cleanAgentData(agentData) {
    if (agentData) {
        // remove Note components
        agentData.data.components = agentData.data.components.filter((c) => c.name != 'Note');

        // remove templateInfo
        delete agentData.data?.templateInfo;

        // TODO : remove UI attributes
    }
    return agentData;
}
