import { afterAll, describe, expect, it, beforeAll } from 'vitest';
import express from 'express';
import config from '@sre/config';
import { AgentProcess, ConnectorService, Conversation, SmythRuntime } from '@sre/index';
import http, { Server } from 'http';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { promisify } from 'util';
import fs from 'fs/promises'; // for promise-based file reading
import fsSync from 'fs';
import { createRegressionTestSuite } from './setup';

const PORT = 8083;
const BASE_URL = `http://localhost:${PORT}`;

const BASE_DIR = './tests/data/SmythRegressionAgents';

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
        Connector: 'Local',
        Settings: {
            devDir: BASE_DIR,
            prodDir: BASE_DIR,
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

    VectorDB: {
        Connector: 'SmythManaged',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
            openaiApiKey: config.env.OPENAI_API_KEY || '',
        },
    },
});

const server = http.createServer(app);

if (!SREInstance.ready()) {
    process.exit(1);
} //force SmythRuntime to initialize

await createRegressionTestSuite(BASE_DIR, { server, port: PORT });
