import dotenv from 'dotenv';
dotenv.config();
//FIXME : this is a legacy structure from Smyth SaaS we need to convert it to a Service/Connector structure
const config = {
    env: {
        LOG_LEVEL: process.env.LOG_LEVEL || 'none',
        LOG_FILTER: process.env.LOG_FILTER || '',

        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,

        DATA_PATH: process.env.DATA_PATH,

        NODE_ENV: process.env?.NODE_ENV,

        AGENT_DOMAIN: process.env?.AGENT_DOMAIN,

        AGENT_DOMAIN_PORT: process.env?.AGENT_DOMAIN_PORT,
        CODE_SANDBOX_URL: process.env?.CODE_SANDBOX_URL,
        TOGETHER_AI_API_URL: process.env?.TOGETHER_AI_API_URL,

        REDIS_SENTINEL_HOSTS: process.env?.REDIS_SENTINEL_HOSTS || '',
        REDIS_MASTER_NAME: process.env?.REDIS_MASTER_NAME,
        REDIS_PASSWORD: process.env?.REDIS_PASSWORD,

        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        AWS_S3_REGION: process.env.AWS_S3_REGION,
        AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,

        PINECONE_API_KEY: process.env.PINECONE_API_KEY,
        PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME,
    },
    agent: {
        ENDPOINT_PREFIX: '/api',
    },
};

export default config;
