import redisClient from '../services/redis';
import { createLogger } from '../services/logger';
const console = createLogger('___FILENAME___');

const ParallelRequestLimiter = async (req, res, next) => {
    const agent: any = req._agent;
    const MAX_PARALLEL_REQUESTS = agent.planInfo.maxParellelRequests || Infinity;
    try {
        //don't block debug calls
        if (agent.usingTestDomain && agent.debugSessionEnabled) {
            return next();
        }

        const agentId = agent.id;

        const key = `agent-server-parallel-requests:${agentId}`;
        const ongoingRequests = parseInt((await redisClient.get(key)) || '0');

        if (ongoingRequests >= MAX_PARALLEL_REQUESTS) {
            console.log('Parallel Request Limit triggered for agent:', agentId, ongoingRequests);
            return res.status(429).json({
                message: 'This agent is running in restricted mode, upgrade your plan or add more tasks to unlock.',
            });
        }

        // Increment the counter
        await redisClient.incr(key);
        // Set an expiration time to avoid stale keys
        await redisClient.expire(key, 60);

        const decrementCounter = async () => {
            await redisClient.decr(key);
        };

        const onFinishOrClose = () => {
            res.removeListener('finish', onFinishOrClose);
            res.removeListener('close', onFinishOrClose);
            decrementCounter();
        };

        res.on('finish', onFinishOrClose);
        res.on('close', onFinishOrClose);

        next();
    } catch (err) {
        console.error('Error in ParallelRequestLimiter:', err);
        res.status(500).json({
            message: 'Internal Server Error',
        });
    }
};

export default ParallelRequestLimiter;
