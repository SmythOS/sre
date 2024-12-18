import cors from 'cors';
import config from '../config';
import { createLogger } from '../services/logger';
const console = createLogger('___FILENAME___');

// Custom CORS middleware
//FIXME : make default CORS configurable from .env file
const corsOptionsDelegate = async (req, callback) => {
    const allowedDomains = [
        'http://localhost:4000',
        'http://localhost:3000',
        'http://localhost:5173',
        'https://auth.smyth.ai',
        'https://auth.smythos.com',
        'https://app.smythos.dev',
        'https://app.smythos.com',
    ];
    const knownHosts = ['localhost', 'agents-server.smyth.prod', 'agents-server.smyth.stage', 'smyth.ai', 'smythos.com', 'smythos.dev'];
    let agentDomain = '';
    let corsOptions;
    if (req._agent) {
        const agent: any = req._agent;
        agentDomain = agent.domain;
    }
    //console.log('CORS Domains =', allowedDomains);
    const origin = req.get('Origin');
    const host = req.get('Host');
    const isSameOrigin = origin === `http://${host}` || origin === `https://${host}`;

    const currentHost = new URL(config.env.BASE_URL || '').host;
    // check if host ends with agent domain ==> these domains are allowed for CORS because they send debug requests
    const isKnownHost =
        (config.env.AGENT_DOMAIN &&
            host.endsWith(`.${config.env.AGENT_DOMAIN}${config.env.AGENT_DOMAIN_PORT ? ':' + config.env.AGENT_DOMAIN_PORT : ''}`)) ||
        (agentDomain && host === agentDomain) ||
        host == currentHost ||
        knownHosts.includes(host);

    if (isKnownHost || isSameOrigin || allowedDomains.includes(req.get('Origin'))) {
        // Enable CORS for the same origin and the allowed domains
        // corsOptions = { origin: true };
        corsOptions = {
            origin: true,
            credentials: true, // Allow credentials (cookies, etc.)
            methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed methods
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Conversation-Id', 'X-Auth-Token', 'X-Parent-Cookie'],
        };
    } else {
        // Disable CORS for other requests
        corsOptions = { origin: false };
        if (req.method == 'OPTIONS') {
            console.log('CORS check ', { path: req.path, host, origin }, '==> Denied ');
            console.log('Allowed Domains for this request ', allowedDomains);
        }
    }

    callback(null, corsOptions);
};

const middleware = cors(corsOptionsDelegate);

export default middleware;
