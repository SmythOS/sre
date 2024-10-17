import { NextFunction, Response } from 'express';
import OIDCMWFactory from './oidc';
import BearerMWFactory from './bearer';

import { createLogger } from '../../services/logger';
const console = createLogger('___FILENAME___');

//this maps to agent.data.auth.provider entry, the selected provider is stored in agent.data.auth.method
const providers = {
    'oauth-oidc': OIDCMWFactory,
    'api-key-bearer': BearerMWFactory,
};

const middleware = async (req: any, res: Response, next: NextFunction) => {
    console.log('Agent Auth Middleware');
    const agent: any = req._agent;
    if (agent.debugSessionEnabled && agent.usingTestDomain) {
        //debug session is enabled, skip auth
        return next();
    }
    if (!agent) {
        return res.status(500).send({ error: 'Agent not found' });
    }
    if (agent?.data?.auth?.method && agent?.data?.auth?.method != 'none') {
        console.log('Using agent-oauth middleware');

        const providerInfo = agent?.data?.auth?.provider[agent?.data?.auth?.method];
        if (!providerInfo) {
            return res.status(401).send({ error: 'Auth provider not configured' });
        }

        const authProvider = providers[agent?.data?.auth?.method];
        const middleware = await authProvider(providerInfo, res);

        return middleware(req, res, next);
    }

    next();
};

export default middleware;
