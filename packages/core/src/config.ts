import dotenv from 'dotenv';
dotenv.config();
//FIXME : this is a legacy structure from Smyth SaaS we need to convert it to a Service/Connector structure
const config = {
    env: {
        LOG_LEVEL: process.env.LOG_LEVEL || 'none',
        LOG_FILTER: process.env.LOG_FILTER || '',

        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
        TOGETHER_AI_API_KEY: process.env.TOGETHER_AI_API_KEY,
        GROQ_API_KEY: process.env.GROQ_API_KEY,
        XAI_API_KEY: process.env.XAI_API_KEY,
        RUNWARE_API_KEY: process.env.RUNWARE_API_KEY,

        DATA_PATH: process.env.DATA_PATH,

        NODE_ENV: process.env?.NODE_ENV,

        AGENT_DOMAIN: process.env?.AGENT_DOMAIN,

        PROD_AGENT_DOMAIN: process.env?.PROD_AGENT_DOMAIN,

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

        LOGTO_SERVER: process.env.LOGTO_SERVER,
        SMYTH_VAULT_API_BASE_URL: process.env.SMYTH_VAULT_API_BASE_URL,

        TAVILY_API_KEY: process.env.TAVILY_API_KEY,

        SCRAPFLY_API_KEY: process.env.SCRAPFLY_API_KEY,
        
        AWS_LAMBDA_ACCESS_KEY_ID: process.env.AWS_LAMBDA_ACCESS_KEY_ID,
        AWS_LAMBDA_SECRET_ACCESS_KEY: process.env.AWS_LAMBDA_SECRET_ACCESS_KEY,
        AWS_LAMBDA_REGION: process.env.AWS_LAMBDA_REGION,
    },
    agent: {
        ENDPOINT_PREFIX: '/api',
    },
};

export default config;
