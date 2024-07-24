import dotenv from 'dotenv';
dotenv.config();

const config = {
    env: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
        TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID,
        TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET,
        BASE_URL: process.env.BASE_URL,
        UI_SERVER: process.env.UI_SERVER,
        DATA_PATH: process.env.DATA_PATH,
        SMYTH_API_BASE_URL: process.env.SMYTH_API_SERVER,

        LOGTO_SERVER: process.env.LOGTO_SERVER,
        LOGTO_API_RESOURCE: process.env.LOGTO_API_RESOURCE,
        LOGTO_M2M_APP_ID: process.env.LOGTO_M2M_APP_ID,
        LOGTO_M2M_APP_SECRET: process.env.LOGTO_M2M_APP_SECRET,

        NODE_ENV: process.env?.NODE_ENV,
        SESSION_SECRET: process.env?.SESSION_SECRET,

        AGENT_DOMAIN: process.env?.AGENT_DOMAIN,
        PROD_AGENT_DOMAIN: process.env?.PROD_AGENT_DOMAIN,
        AGENT_DOMAIN_PORT: process.env?.AGENT_DOMAIN_PORT,
        COHERE_PRIVATE_KEY: process.env?.COHERE_PRIVATE_KEY,
        COHERE_URL: process.env?.COHERE_URL,
        COHERE_TENANCY_ID: process.env?.COHERE_TENANCY_ID,
        COHERE_USER_ID: process.env?.COHERE_USER_ID,
        COHERE_KEY_FINGERPRINT: process.env?.COHERE_KEY_FINGERPRINT,
        CODE_SANDBOX_URL: process.env?.CODE_SANDBOX_URL,
        TOGETHER_AI_API_URL: process.env?.TOGETHER_AI_API_URL,

        REDIS_SENTINEL_HOSTS: process.env?.REDIS_SENTINEL_HOSTS || '',
        REDIS_MASTER_NAME: process.env?.REDIS_MASTER_NAME,
        REDIS_PASSWORD: process.env?.REDIS_PASSWORD,

        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        AWS_S3_REGION: process.env.AWS_S3_REGION,
        AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
        REQ_LIMIT_PER_SECOND: process.env.REQ_LIMIT_PER_SECOND || 30,
        REQ_LIMIT_PER_MINUTE: process.env.REQ_LIMIT_PER_MINUTE || 300,
        REQ_LIMIT_PER_HOUR: process.env.REQ_LIMIT_PER_HOUR || 10000,
        MAX_LATENCY_FREE_USER: process.env.MAX_LATENCY_FREE_USER || 100,
        MAX_LATENCY_PAID_USER: process.env.MAX_LATENCY_PAID_USER || 10,

        GOOGLEAI_API_KEY: process.env.GOOGLEAI_API_KEY,
        PINECONE_API_KEY: process.env.PINECONE_API_KEY,
        PINCECONE_INDEX_NAME: process.env.PINCECONE_INDEX_NAME,
    },
    agent: {
        ENDPOINT_PREFIX: '/api',
    },
};

export default config;
