import Redis from 'ioredis';
import config from '../config';

import { createLogger } from '../services/logger';
const console = createLogger('___FILENAME___');

const sentinelHosts = config?.env?.REDIS_SENTINEL_HOSTS || '';
const password = config?.env?.REDIS_PASSWORD || '';
const masterName = config?.env?.REDIS_MASTER_NAME || '';

const sentinels = sentinelHosts
    .split(',')
    ?.map((host) => {
        const [hostName, port] = host.split(':');
        return {
            host: hostName,
            port: Number(port),
        };
    })
    .filter((host) => host.host && host.port);

const redis = new Redis({
    sentinels,
    name: masterName,
    password,
});

redis.on('error', (error) => {
    // Error Handler
    // We opted not to log the error here because 'ioredis' retries connecting every second, leading to numerous logs.
    // We'll set up logging after establishing a more efficient retry strategy.
});

redis.on('connect', () => {
    console.log('Redis connected!');
});

export default redis;
