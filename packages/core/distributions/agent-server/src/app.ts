import 'source-map-support/register.js';
import express from 'express';
import agentRouter from './routes/agent/router';
import cors from './middlewares/cors.mw';
import RateLimiter from './middlewares/RateLimiter.mw';
import config from './config';
import url from 'url';
import path from 'path';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middlewares/error.mw';
import { createLogger } from './services/logger';

import { Server } from 'http';
import { startServers } from './management-router';

import { SmythRuntime } from '../../../src/index.ts';

const app = express();
const port = parseInt(process.env.PORT || '3000');
const BASE_URL = `http://localhost:${port}`;

const sre = SmythRuntime.Instance.init({
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: process.env.AWS_S3_BUCKET_NAME || '',
            region: process.env.AWS_S3_REGION || '',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
    Cache: {
        Connector: 'Redis',
        Settings: {
            hosts: config.env.REDIS_SENTINEL_HOSTS,
            name: config.env.REDIS_MASTER_NAME || '',
            password: config.env.REDIS_PASSWORD || '',
        },
    },
    Account: {
        Connector: 'SmythAccount',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
        },
    },
    Vault: {
        Connector: 'SmythVault',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            vaultAPIBaseUrl: process.env.SMYTH_VAULT_API_BASE_URL,
        },
    },

    AgentData: {
        Connector: 'Smyth',
        Settings: {
            agentStageDomain: config.env.AGENT_DOMAIN || '',
            agentProdDomain: config.env.PROD_AGENT_DOMAIN || '',
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
        },
    },
    NKV: {
        Connector: 'Redis',
        Settings: {},
    },

    VectorDB: {
        Connector: 'SmythManaged',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
            openaiApiKey: process.env.OPENAI_API_KEY || '',
        },
    },

    Router: {
        Connector: 'ExpressRouter',
        Settings: {
            router: app,
            baseUrl: BASE_URL,
        },
    },
});

// @ts-ignore

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const console = createLogger('app.ts');

app.disable('x-powered-by');

app.set('trust proxy', 1);
//app.use(RateLimiter);
app.use(cookieParser());

app.use(RateLimiter);
app.use(cors, express.json({ limit: '10mb' }));
app.use(cors, express.urlencoded({ extended: false, limit: '100kb' }));

app.get('/', (req, res) => {
    res.send('Agent Server');
});

app.get('/health', (req, res) => {
    let agent_domain = config.env.AGENT_DOMAIN;
    if (config.env.AGENT_DOMAIN_PORT) agent_domain += `:${config.env.AGENT_DOMAIN_PORT}`;
    res.send({
        message: 'Health Check Complete',
        hostname: req.hostname,
        agent_domain,
        success: true,
        node: port?.toString()?.substr(2),
        name: 'agent-server',
        // version: pkg.version,
    });
});

//app.use(auth);

app.use('/', agentRouter);

// @ts-ignore
app.use(errorHandler);

let server: Server | null = null;
(async () => {
    try {
        // start management server
        server = startServers();
    } catch (error) {
        console.error(error);
    }
})();

process.on('uncaughtException', (err) => {
    console.error('An uncaught error occurred!');
    console.error(err.stack);
});

export { app };
