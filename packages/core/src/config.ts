import dotenv from 'dotenv';
dotenv.config();
//FIXME : this is a legacy structure from Smyth SaaS we need to convert it to a Service/Connector structure
const config = {
    env: {
        LOG_LEVEL: process.env.LOG_LEVEL || 'none',
        LOG_FILTER: process.env.LOG_FILTER || '',
        NODE_ENV: process.env?.NODE_ENV,
        ROLLOUT_RAG_V2: process.env.ROLLOUT_RAG_V2,
    },
    agent: {
        ENDPOINT_PREFIX: '/api',
    },
};

export default config;
