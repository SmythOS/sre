import { afterAll, describe, expect, it, beforeAll } from 'vitest';
import express from 'express';
import config from '@sre/config';
import { SmythRuntime } from '@sre/index';
import http, { Server } from 'http';
import { promisify } from 'util';

const PORT = 8083;
const BASE_URL = `http://localhost:${PORT}`;

const app = express();

const SREInstance = SmythRuntime.Instance.init({
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
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: config.env.AWS_S3_BUCKET_NAME || '',
            region: config.env.AWS_S3_REGION || '',
            accessKeyId: config.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: config.env.AWS_SECRET_ACCESS_KEY || '',
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
    Router: {
        Connector: 'ExpressRouter',
        Settings: {
            router: app,
            baseUrl: BASE_URL,
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
});

const server = http.createServer(app);

if (!SREInstance.ready()) {
    process.exit(1);
} //force SmythRuntime to initialize

describe('Smyth Agent Regression Tests', () => {
    beforeAll(async () => {
        const listen = promisify(server.listen.bind(server));
        await listen(PORT);
        console.log(`Server is running on port ${PORT}`);
    });

    afterAll(async () => {
        const close = promisify(server.close.bind(server));
        await close();
        console.log('Server has been shut down');
    });
});
