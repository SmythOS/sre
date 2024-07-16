import IORedis from 'ioredis';
import { createLogger } from '@sre/Core/Logger';
import { IAccessRequest, IACL } from '@sre/types/ACL.types';
import { CacheMetadata } from '@sre/types/Cache.types';
import { CacheConnector, ICacheConnector } from '../CacheConnector';

import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { RedisConfig } from '@sre/types/Redis.types';

import { Connector } from '@sre/Core/Connector.class';

const console = createLogger('RedisCache');

export class RedisCache extends CacheConnector {
    public name: string = 'RedisCache';
    private redis: IORedis;
    private prefix: string = 'CACHE';

    constructor(settings: RedisConfig) {
        super();
        const sentinels = parseSentinelHosts(settings.hosts);

        this.redis = new IORedis({
            sentinels,
            name: settings.name,
            password: settings.password,
        });

        this.redis.on('error', (error) => {
            console.error('Redis Error:', error);
        });

        this.redis.on('connect', () => {
            console.log('Redis connected!');
        });
    }

    public async get(key: string): Promise<string | null> {
        return this.redis.get(`${this.prefix}:${key}`);
    }

    public async set(key: string, data: any, acl?: IACL, metadata?: CacheMetadata, ttl?: number): Promise<boolean> {
        const promises: any[] = [];

        promises.push(this.redis.set(`${this.prefix}:${key}`, data));

        if (metadata || acl) {
            const newMetadata: CacheMetadata = metadata || {};
            newMetadata.acl = acl || {};
            promises.push(this.setMetadata(key, newMetadata));
        }

        if (ttl) {
            promises.push(this.updateTTL(key, ttl));
        }

        await Promise.all(promises);
        return true;
    }

    public async delete(key: string): Promise<void> {
        //delete both the key and its metadata
        await Promise.all([this.redis.del(`${this.prefix}:${key}`), this.redis.del(`${this.prefix}:${key}:metadata`)]);
    }

    public async exists(key: string): Promise<boolean> {
        return !!(await this.redis.exists(`${this.prefix}:${key}`));
    }

    public async getMetadata(key: string): Promise<CacheMetadata> {
        if (!this.exists(key)) throw new Error(`Resource ${key} not found`);
        try {
            const metadata = await this.redis.get(`${this.prefix}:${key}:metadata`);
            return metadata ? (this.deserializeRedisMetadata(metadata) as CacheMetadata) : {};
        } catch (error) {
            return {};
        }
    }

    public async setMetadata(key: string, metadata: CacheMetadata): Promise<void> {
        await this.redis.set(`${this.prefix}:${key}:metadata`, this.serializeRedisMetadata(metadata));
    }

    public async updateTTL(key: string, ttl?: number): Promise<void> {
        if (ttl) {
            await Promise.all([this.redis.expire(`${this.prefix}:${key}`, ttl), this.redis.expire(`${this.prefix}:${key}:metadata`, ttl)]);
        }
    }

    public async getTTL(key: string): Promise<number> {
        return this.redis.ttl(`${this.prefix}:${key}`);
    }

    async hasAccess(request: IAccessRequest): Promise<boolean> {
        try {
            const metadata = await this.getMetadata(request.resourceId);
            const acl: IACL = metadata?.acl as IACL;
            return ACL.from(acl).checkExactAccess(request);
        } catch (error) {
            if (error.name === 'NotFound') {
                return false;
            }
            console.error(`Error checking access rights in S3`, error.name, error.message);
            throw error;
        }
    }

    async getACL(resourceId: string): Promise<IACL> {
        try {
            const metadata = await this.getMetadata(resourceId);
            return (metadata?.acl as IACL) || {};
        } catch (error) {
            console.error(`Error getting access rights in S3`, error.name, error.message);
            throw error;
        }
    }

    async setACL(resourceId: string, acl: IACL) {
        try {
            let metadata = await this.getMetadata(resourceId);
            if (!metadata) metadata = {};
            metadata.acl = acl;
            await this.setMetadata(resourceId, metadata);
        } catch (error) {
            console.error(`Error setting access rights in S3`, error);
            throw error;
        }
    }

    private serializeRedisMetadata(redisMetadata: Record<string, any> | undefined): string {
        if (!redisMetadata) return '';
        if (redisMetadata.acl) {
            const acl: IACL = redisMetadata.acl;
            if (acl) {
                redisMetadata.acl = ACL.from(acl).serializedACL;
            }
        }

        return JSON.stringify(redisMetadata);
    }

    private deserializeRedisMetadata(strMetadata: string): Record<string, any> {
        try {
            const redisMetadata = JSON.parse(strMetadata);
            if (redisMetadata.acl) {
                const acl: IACL = ACL.from(redisMetadata.acl).ACL;
                redisMetadata.acl = acl;
            }

            return redisMetadata;
        } catch (error) {
            console.warn(`Error deserializing metadata`, strMetadata);
            return {};
        }
    }

    public async stop() {
        super.stop();
        await this.redis.quit();
    }
}

/**
 * hosts can take any of the following formats:
 * 1. A string with comma-separated host:port pairs
 * 2. An array of strings with host:port pairs
 * 3. An array of objects with host and port properties
 * @param hosts
 */
function parseSentinelHosts(hosts: string | string[] | any[]) {
    //handle all possible formats of hosts
    if (typeof hosts === 'string') {
        return hosts.split(',').map((host) => {
            const [hostName, port] = host.split(':');
            return {
                host: hostName,
                port: Number(port),
            };
        });
    } else if (Array.isArray(hosts)) {
        return hosts.map((host) => {
            if (typeof host === 'string') {
                const [hostName, port] = host.split(':');
                return {
                    host: hostName,
                    port: Number(port),
                };
            } else {
                return host;
            }
        });
    } else {
        return [];
    }
}
