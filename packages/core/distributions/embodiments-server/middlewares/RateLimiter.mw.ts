import config from '../config';
import redisClient from '../utils/redis';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { createLogger } from '../utils/logger';
const logger = createLogger('RateLimiter.mw.ts');

const REQ_LIMIT_PER_SECOND = parseInt((config.env.REQ_LIMIT_PER_SECOND as any) || '30');
const REQ_LIMIT_PER_MINUTE = parseInt((config.env.REQ_LIMIT_PER_MINUTE as any) || '300');
const REQ_LIMIT_PER_HOUR = parseInt((config.env.REQ_LIMIT_PER_HOUR as any) || '10000');

const secondLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'agent-server-rl-second:',
    points: REQ_LIMIT_PER_SECOND, // limit each IP to 10 requests per second
    duration: 1, // 1 second
    blockDuration: 0, // do not block if consumed more than points
});

const minuteLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'agent-server-rl-minute:',
    points: REQ_LIMIT_PER_MINUTE, // limit each IP to 300 requests per minute
    duration: 60, // 1 minute
    blockDuration: 0, // do not block if consumed more than points
});

const hourLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'agent-server-rl-hour:',
    points: REQ_LIMIT_PER_HOUR, // limit each IP to 10000 requests per hour
    duration: 3600, // 1 hour
    blockDuration: 0, // do not block if consumed more than points
});

const RateLimiter = async (req, res, next) => {
    try {
        //exclude private IPs starting with 10.20.x.x and 10.30.x.x
        if (req.ip.startsWith('10.20.') || req.ip.startsWith('10.30.')) {
            return next();
        }

        const [secondLimiterRes, minuteLimiterRes, hourLimiterRes] = await Promise.all([
            secondLimiter.consume(req.ip),
            minuteLimiter.consume(req.ip),
            hourLimiter.consume(req.ip),
        ]);

        next();
    } catch (err) {
        console.log('Rate Limit triggered for IP:', req.ip);
        res.status(429).json({
            message: 'Too many requests from this IP, please try again later.',
        });
    }
};

export default RateLimiter;
