import dotenv from 'dotenv';
dotenv.config();

const config = {
    env: {
        ADMIN_PORT: process.env.ADMIN_PORT || 8080,

        BASE_URL: process.env.BASE_URL,
        SMYTH_API_BASE_URL: process.env.SMYTH_API_SERVER,

        LOGTO_SERVER: process.env.LOGTO_SERVER,
        LOGTO_API_RESOURCE: process.env.LOGTO_API_RESOURCE,
        LOGTO_M2M_APP_ID: process.env.LOGTO_M2M_APP_ID,
        LOGTO_M2M_APP_SECRET: process.env.LOGTO_M2M_APP_SECRET,

        NODE_ENV: process.env?.NODE_ENV,

        AGENT_DOMAIN: process.env?.AGENT_DOMAIN,
        PROD_AGENT_DOMAIN: process.env?.PROD_AGENT_DOMAIN,
        AGENT_DOMAIN_PORT: process.env?.AGENT_DOMAIN_PORT,

        REDIS_SENTINEL_HOSTS: process.env?.REDIS_SENTINEL_HOSTS || '',
        REDIS_MASTER_NAME: process.env?.REDIS_MASTER_NAME,
        REDIS_PASSWORD: process.env?.REDIS_PASSWORD,

        REQ_LIMIT_PER_SECOND: process.env.REQ_LIMIT_PER_SECOND || 30,
        REQ_LIMIT_PER_MINUTE: process.env.REQ_LIMIT_PER_MINUTE || 300,
        REQ_LIMIT_PER_HOUR: process.env.REQ_LIMIT_PER_HOUR || 10000,
        MAX_LATENCY_FREE_USER: process.env.MAX_LATENCY_FREE_USER || 100,
        MAX_LATENCY_PAID_USER: process.env.MAX_LATENCY_PAID_USER || 10,
    },
};

export default config;
