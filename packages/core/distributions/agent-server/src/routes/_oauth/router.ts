import express from 'express';
import axios from 'axios';
import querystring from 'querystring';
import config from '../../config.js';
import AgentLoader from '../../middlewares/AgentLoader.mw';
import { readAgentOAuthConfig } from '../../services/agent-helper.js';
import { Request, Response } from 'express';

const router = express.Router();

router.use(AgentLoader);
// @ts-ignore
router.get('/authorize', async (req: Request, res: Response) => {
    //@ts-ignore
    const agent: Agent = req._agent;
    if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
    }
    const authInfo = await readAgentOAuthConfig(agent);
    const authorizationURL = authInfo.authorizationURL;
    const tokenUrl = authInfo.tokenURL;
    const client_id = authInfo.clientID;
    const client_secret = authInfo.clientSecret;

    if (!client_id || !client_secret) {
        return res.status(404).json({ error: 'Agent not configured for OAuth' });
    }

    console.log('OIDC:AUTHORIZE', req.query);
    const query: any = { ...req.query, client_id, prompt: 'consent', scope: req.query.scope || 'openid offline_access profile email' };
    console.log('OIDC:AUTHORIZE PATCHED for OIDC', query);
    // Here, we maintain the original query parameters in the redirection
    const redirectUrl = new URL(authorizationURL);
    redirectUrl.search = new URLSearchParams(query).toString();

    console.log('OIDC:AUTHORIZE redir URL', redirectUrl.href);
    res.redirect(redirectUrl.href);
});

// @ts-ignore
router.post('/token', async (req: Request, res: Response) => {
    // @ts-ignore
    const agent: Agent = req._agent;
    if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
    }
    const authInfo = await readAgentOAuthConfig(agent);
    const authorizationURL = authInfo.authorizationURL;
    const tokenUrl = authInfo.tokenURL;
    const client_id = authInfo.clientID;
    const client_secret = authInfo.clientSecret;

    if (!client_id || !client_secret) {
        return res.status(404).json({ error: 'Agent not configured for OAuth' });
    }

    console.log('OIDC:TOKEN', req.body);
    const data = { ...req.body, client_id, client_secret };
    console.log('OIDC:TOKEN Patched for OIDC', data);
    try {
        const result = await axios.post(tokenUrl, querystring.stringify(data), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        console.log('OIDC:AUTH', result.data);
        res.json(result.data);
    } catch (error: any) {
        if (error?.response?.status === 400) {
            console.log('OIDC:AUTH ERROR status 400', error?.response?.data);
            return res.status(400).json(error?.response?.data);
            // const fakeToken = {
            //     access_token: '0000401-' + req.body.refresh_token,
            //     expires_in: 3600,
            //     //id_token: '',
            //     refresh_token: req.body.refresh_token,
            //     scope: 'offline_access openid profile email',
            //     token_type: 'Bearer',
            // };
            // return res.status(200).json(fakeToken);
        }
        console.log('OIDC:AUTH ERROR 500', error);
        res.status(500).json({ message: 'An error occurred' });
    }
});

export default router;
