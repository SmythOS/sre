import { Logger } from '@sre/helpers/Log.helper';
import { IAccessCandidate, IACL, TAccessLevel } from '@sre/types/ACL.types';
import { CacheMetadata } from '@sre/types/Cache.types';
import IORedis from 'ioredis';
import { CacheConnector } from '../CacheConnector';

import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { RedisConfig } from '@sre/types/Redis.types';

import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { ConnectorService } from '@sre/Core/ConnectorsService';

const console = Logger('RedisCache');

export class RedisCache extends CacheConnector {
    public name: string = 'RedisCache';
    private redis: IORedis;
    private prefix: string = 'smyth:cache';
    private mdPrefix: string = 'smyth:metadata';

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

    public get client() {
        return this.redis;
    }

    public key(...parts: string[]) {
        return `${this.prefix}:${parts.join(':')}`;
    }

    public mdKey(...parts: string[]) {
        return `${this.mdPrefix}:${parts.join(':')}`;
    }

    @SecureConnector.AccessControl
    public async get(acRequest: AccessRequest, key: string): Promise<string | null> {
        const value = await this.redis.get(`${this.prefix}:${key}`);
        return value;
    }

    @SecureConnector.AccessControl
    public async set(acRequest: AccessRequest, key: string, data: any, acl?: IACL, metadata?: CacheMetadata, ttl?: number): Promise<boolean> {
        const accessCandidate = acRequest.candidate;
        const promises: any[] = [];

        promises.push(this.redis.set(`${this.prefix}:${key}`, data));

        const newMetadata: CacheMetadata = metadata || {};
        newMetadata.acl = ACL.from(acl).addAccess(accessCandidate.role, accessCandidate.id, TAccessLevel.Owner).ACL;
        promises.push(this.setMetadata(acRequest, key, newMetadata));

        if (ttl) {
            promises.push(this.updateTTL(acRequest, key, ttl));
        }

        await Promise.all(promises);
        return true;
    }

    @SecureConnector.AccessControl
    public async delete(acRequest: AccessRequest, key: string): Promise<void> {
        //delete both the key and its metadata
        await Promise.all([this.redis.del(`${this.prefix}:${key}`), this.redis.del(`${this.mdPrefix}:${key}`)]);
    }

    @SecureConnector.AccessControl
    public async exists(acRequest: AccessRequest, key: string): Promise<boolean> {
        return !!(await this.redis.exists(`${this.prefix}:${key}`));
    }

    @SecureConnector.AccessControl
    public async getMetadata(acRequest: AccessRequest, key: string): Promise<CacheMetadata> {
        if (!this.exists(acRequest, key)) return undefined;
        try {
            const metadata = await this.redis.get(`${this.mdPrefix}:${key}`);
            return metadata ? (this.deserializeRedisMetadata(metadata) as CacheMetadata) : {};
        } catch (error) {
            return {};
        }
    }

    @SecureConnector.AccessControl
    public async setMetadata(acRequest: AccessRequest, key: string, metadata: CacheMetadata): Promise<void> {
        await this.redis.set(`${this.mdPrefix}:${key}`, this.serializeRedisMetadata(metadata));
    }

    @SecureConnector.AccessControl
    public async updateTTL(acRequest: AccessRequest, key: string, ttl?: number): Promise<void> {
        if (ttl) {
            await Promise.all([this.redis.expire(`${this.prefix}:${key}`, ttl), this.redis.expire(`${this.mdPrefix}:${key}`, ttl)]);
        }
    }

    @SecureConnector.AccessControl
    public async getTTL(acRequest: AccessRequest, key: string): Promise<number> {
        return this.redis.ttl(`${this.prefix}:${key}`);
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        const _metadata: any = await this.redis.get(`${this.mdPrefix}:${resourceId}`).catch((error) => {});
        const exists = _metadata !== undefined && _metadata !== null; //null or undefined metadata means the resource does not exist
        const metadata = exists ? this.deserializeRedisMetadata(_metadata) : {};

        if (!exists) {
            //the resource does not exist yet, we grant write access to the candidate in order to allow the resource creation
            return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
        }
        return ACL.from(metadata?.acl as IACL);
    }

    // async hasAccess(request: IAccessRequest): Promise<boolean> {
    //     try {
    //         const metadata = await this.getMetadata(request.resourceId);
    //         const acl: IACL = metadata?.acl as IACL;
    //         return ACL.from(acl).checkExactAccess(request);
    //     } catch (error) {
    //         if (error.name === 'NotFound') {
    //             return false;
    //         }
    //         console.error(`Error checking access rights in S3`, error.name, error.message);
    //         throw error;
    //     }
    // }

    @SecureConnector.AccessControl
    async getACL(acRequest: AccessRequest, key: string): Promise<IACL> {
        try {
            const metadata = await this.getMetadata(acRequest, key);
            return (metadata?.acl as IACL) || {};
        } catch (error) {
            console.error(`Error getting access rights in S3`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async setACL(acRequest: AccessRequest, key: string, acl: IACL) {
        try {
            let metadata = await this.getMetadata(acRequest, key);
            if (!metadata) metadata = {};
            //when setting ACL make sure to not lose ownership
            metadata.acl = ACL.from(acl).addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
            await this.setMetadata(acRequest, key, metadata);
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
