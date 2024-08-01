import { Connector } from '@sre/Core/Connector.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IACL, IAccessCandidate, IAccessRequest } from '@sre/types/ACL.types';
import { CacheMetadata } from '@sre/types/Cache.types';

export interface ICacheRequest {
    get: (key: string) => Promise<any>;

    /**
     * Set a value in the cache
     * @param key
     * @param data
     * @param acl
     * @param metadata
     * @param ttl Cache time to live in seconds
     * @returns
     */
    set: (key: string, data: any, acl?: IACL, metadata?: CacheMetadata, ttl?: number) => Promise<boolean>;
    delete: (key: string) => Promise<void>;
    exists: (key: string) => Promise<boolean>;

    getMetadata: (key: string) => Promise<CacheMetadata | undefined>;
    setMetadata: (key: string, metadata: CacheMetadata) => Promise<void>;

    updateTTL: (key: string, ttl?: number) => Promise<void>;
    getTTL: (key: string) => Promise<number>;

    getACL: (key: string) => Promise<IACL | undefined>;
    setACL: (key: string, acl: IACL) => Promise<void>;
}

export abstract class CacheConnector extends SecureConnector {
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;
    public user(candidate: AccessCandidate): ICacheRequest {
        return {
            get: async (key: string) => {
                return await this.get(candidate.readRequest, key);
            },
            set: async (key: string, data: any, acl?: IACL, metadata?: CacheMetadata, ttl?: number) => {
                return await this.set(candidate.writeRequest, key, data, acl, metadata, ttl);
            },
            delete: async (key: string) => {
                await this.delete(candidate.writeRequest, key);
            },
            exists: async (key: string) => {
                return await this.exists(candidate.readRequest, key);
            },

            getMetadata: async (key: string) => {
                return await this.getMetadata(candidate.readRequest, key);
            },
            setMetadata: async (key: string, metadata: CacheMetadata) => {
                await this.setMetadata(candidate.writeRequest, key, metadata);
            },
            updateTTL: async (key: string, ttl?: number) => {
                await this.updateTTL(candidate.writeRequest, key, ttl);
            },
            getTTL: async (key: string) => {
                return await this.getTTL(candidate.readRequest, key);
            },
            getACL: async (key: string) => {
                return await this.getACL(candidate.readRequest, key);
            },
            setACL: async (key: string, acl: IACL) => {
                await this.setACL(candidate.writeRequest, key, acl);
            },
        };
    }

    abstract get(acRequest: AccessRequest, key: string): Promise<any>;
    abstract set(acRequest: AccessRequest, key: string, data: any, acl?: IACL, metadata?: CacheMetadata, ttl?: number): Promise<boolean>;
    abstract delete(acRequest: AccessRequest, key: string): Promise<void>;
    abstract exists(acRequest: AccessRequest, key: string): Promise<boolean>;

    abstract getMetadata(acRequest: AccessRequest, key: string): Promise<CacheMetadata | undefined>;
    abstract setMetadata(acRequest: AccessRequest, key: string, metadata: CacheMetadata): Promise<void>;

    abstract updateTTL(acRequest: AccessRequest, key: string, ttl?: number): Promise<void>;
    abstract getTTL(acRequest: AccessRequest, key: string): Promise<number>;

    abstract getACL(acRequest: AccessRequest, key: string): Promise<IACL | undefined>;
    abstract setACL(acRequest: AccessRequest, key: string, acl: IACL): Promise<void>;
}
