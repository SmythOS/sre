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
    private _prefix: string = 'smyth:cache';
    private _mdPrefix: string = 'smyth:metadata';

    constructor(protected _settings: RedisConfig) {
        super(_settings);
        const sentinels = parseSentinelHosts(_settings.hosts || process.env.REDIS_HOSTS);
        let host = sentinels.length === 1 ? sentinels[0].host : null;
        let port = sentinels.length === 1 ? sentinels[0].port : null;

        this.redis = new IORedis({
            ...(host ? { host, port } : { sentinels, name: _settings.name || process.env.REDIS_MASTER_NAME }),
            password: _settings.password || process.env.REDIS_PASSWORD,
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

    public get prefix() {
        return this._prefix;
    }

    public get mdPrefix() {
        return this._mdPrefix;
    }

    @SecureConnector.AccessControl
    public async get(acRequest: AccessRequest, key: string): Promise<string | null> {
        const value = await this.redis.get(`${this._prefix}:${key}`);
        return value;
    }

    @SecureConnector.AccessControl
    public async set(acRequest: AccessRequest, key: string, data: any, acl?: IACL, metadata?: CacheMetadata, ttl?: number): Promise<boolean> {
        const accessCandidate = acRequest.candidate;
        const promises: any[] = [];

        const newMetadata: CacheMetadata = metadata || {};
        newMetadata.acl = ACL.from(acl).addAccess(accessCandidate.role, accessCandidate.id, TAccessLevel.Owner).ACL;

        if (ttl && ttl > 0) {
            promises.push(this.redis.set(`${this._prefix}:${key}`, data, 'EX', ttl));
            promises.push(this.setMetadataWithTTL(acRequest, key, newMetadata, ttl));
        } else {
            promises.push(this.redis.set(`${this._prefix}:${key}`, data));
            promises.push(this.setMetadata(acRequest, key, newMetadata));
        }

        await Promise.all(promises);

        // if (ttl) {
        //     try {
        //         await this.updateTTL(acRequest, key, ttl);
        //     } catch (error) {
        //         console.error(`Error setting TTL for key ${key}`, error);
        //     }
        // }

        return true;
    }

    @SecureConnector.AccessControl
    public async delete(acRequest: AccessRequest, key: string): Promise<void> {
        //delete both the key and its metadata
        await Promise.all([this.redis.del(`${this._prefix}:${key}`), this.redis.del(`${this._mdPrefix}:${key}`)]);
    }

    @SecureConnector.AccessControl
    public async exists(acRequest: AccessRequest, key: string): Promise<boolean> {
        return !!(await this.redis.exists(`${this._prefix}:${key}`));
    }

    @SecureConnector.AccessControl
    public async getMetadata(acRequest: AccessRequest, key: string): Promise<CacheMetadata> {
        if (!this.exists(acRequest, key)) return undefined;
        try {
            const metadata = await this.redis.get(`${this._mdPrefix}:${key}`);
            return metadata ? (this.deserializeRedisMetadata(metadata) as CacheMetadata) : {};
        } catch (error) {
            return {};
        }
    }

    @SecureConnector.AccessControl
    public async setMetadata(acRequest: AccessRequest, key: string, metadata: CacheMetadata): Promise<void> {
        if (metadata.acl) {
            //preserve the ownership of the metadata
            const newACL = ACL.from(metadata.acl).addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
            metadata.acl = newACL;
        }

        //no ACL present ==> preserve the existing ACL
        if (!metadata.acl) {
            const curACL = await this.getACL(acRequest, key);
            metadata.acl = curACL;
        }

        await this.setMetadataWithTTL(acRequest, key, metadata);
    }
    private async setMetadataWithTTL(acRequest: AccessRequest, key: string, metadata: CacheMetadata, ttl?: number): Promise<void> {
        if (ttl && ttl > 0) {
            await this.redis.set(`${this._mdPrefix}:${key}`, this.serializeRedisMetadata(metadata), 'EX', ttl);
        } else {
            await this.redis.set(`${this._mdPrefix}:${key}`, this.serializeRedisMetadata(metadata));
        }
    }

    @SecureConnector.AccessControl
    public async updateTTL(acRequest: AccessRequest, key: string, ttl?: number): Promise<void> {
        if (ttl) {
            await Promise.all([this.redis.expire(`${this._prefix}:${key}`, ttl), this.redis.expire(`${this._mdPrefix}:${key}`, ttl)]);
        }
    }

    @SecureConnector.AccessControl
    public async getTTL(acRequest: AccessRequest, key: string): Promise<number> {
        return this.redis.ttl(`${this._prefix}:${key}`);
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        const _metadata: any = await this.redis.get(`${this._mdPrefix}:${resourceId}`).catch((error) => {});
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
