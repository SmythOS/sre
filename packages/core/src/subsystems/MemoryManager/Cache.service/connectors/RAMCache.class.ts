import { Logger } from '@sre/helpers/Log.helper';
import { IAccessCandidate, IACL, TAccessLevel } from '@sre/types/ACL.types';
import { CacheMetadata } from '@sre/types/Cache.types';
import { CacheConnector } from '../CacheConnector';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { debounce } from '@sre/utils/general.utils';

const console = Logger('RAMCache');

interface CacheEntry {
    value: any;
    metadata: CacheMetadata;
    expiresAt?: number;
}

export class RAMCache extends CacheConnector {
    public name: string = 'RAMCache';
    private _prefix: string = 'smyth:cache';
    private _mdPrefix: string = 'smyth:metadata';
    private cache: Map<string, CacheEntry> = new Map();
    private cleanupInterval: NodeJS.Timeout;

    constructor(protected _settings: any) {
        super(_settings);
        // Set up cleanup interval to remove expired entries

        this.cleanupInterval = setInterval(() => this.cleanupExpiredEntries(), 60000); // Clean up every minute
        this.cleanupInterval.unref();
    }

    public get prefix() {
        return this._prefix;
    }

    public get mdPrefix() {
        return this._mdPrefix;
    }

    private getFullKey(key: string): string {
        return `${this._prefix}:${key}`;
    }

    private getFullMetadataKey(key: string): string {
        return `${this._mdPrefix}:${key}`;
    }

    private cleanupExpiredEntries() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt && entry.expiresAt < now) {
                this.cache.delete(key);
            }
        }
    }

    @SecureConnector.AccessControl
    public async get(acRequest: AccessRequest, key: string): Promise<string | null> {
        const fullKey = this.getFullKey(key);
        const entry = this.cache.get(fullKey);

        if (!entry) return null;

        if (entry.expiresAt && entry.expiresAt < Date.now()) {
            this.cache.delete(fullKey);
            return null;
        }

        return entry.value;
    }

    @SecureConnector.AccessControl
    public async set(acRequest: AccessRequest, key: string, data: any, acl?: IACL, metadata?: CacheMetadata, ttl?: number): Promise<boolean> {
        const accessCandidate = acRequest.candidate;
        const fullKey = this.getFullKey(key);
        const fullMetadataKey = this.getFullMetadataKey(key);

        const newMetadata: CacheMetadata = metadata || {};
        newMetadata.acl = ACL.from(acl).addAccess(accessCandidate.role, accessCandidate.id, TAccessLevel.Owner).ACL;

        const entry: CacheEntry = {
            value: data,
            metadata: newMetadata,
            expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
        };

        this.cache.set(fullKey, entry);
        this.cache.set(fullMetadataKey, entry);

        return true;
    }

    @SecureConnector.AccessControl
    public async delete(acRequest: AccessRequest, key: string): Promise<void> {
        const fullKey = this.getFullKey(key);
        const fullMetadataKey = this.getFullMetadataKey(key);
        this.cache.delete(fullKey);
        this.cache.delete(fullMetadataKey);
    }

    @SecureConnector.AccessControl
    public async exists(acRequest: AccessRequest, key: string): Promise<boolean> {
        const fullKey = this.getFullKey(key);
        const entry = this.cache.get(fullKey);

        if (!entry) return false;

        if (entry.expiresAt && entry.expiresAt < Date.now()) {
            this.cache.delete(fullKey);
            return false;
        }

        return true;
    }

    @SecureConnector.AccessControl
    public async getMetadata(acRequest: AccessRequest, key: string): Promise<CacheMetadata> {
        if (!(await this.exists(acRequest, key))) return undefined;

        const fullMetadataKey = this.getFullMetadataKey(key);
        const entry = this.cache.get(fullMetadataKey);
        return entry?.metadata || {};
    }

    @SecureConnector.AccessControl
    public async setMetadata(acRequest: AccessRequest, key: string, metadata: CacheMetadata): Promise<void> {
        const fullMetadataKey = this.getFullMetadataKey(key);
        const entry = this.cache.get(fullMetadataKey);

        if (entry) {
            const existingMetadata = entry.metadata || {};
            const existingAcl = existingMetadata?.acl;
            const mergedMetadata: CacheMetadata = { ...existingMetadata, ...metadata } as CacheMetadata;

            // Preserve or establish ACL; always ensure requester retains ownership
            if (existingAcl) {
                mergedMetadata.acl = ACL.from(existingAcl).addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
            } else if (mergedMetadata.acl) {
                mergedMetadata.acl = ACL.from(mergedMetadata.acl).addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
            } else {
                mergedMetadata.acl = new ACL().addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
            }

            entry.metadata = mergedMetadata;
            this.cache.set(fullMetadataKey, entry);
        }
    }

    @SecureConnector.AccessControl
    public async updateTTL(acRequest: AccessRequest, key: string, ttl?: number): Promise<void> {
        const fullKey = this.getFullKey(key);
        const fullMetadataKey = this.getFullMetadataKey(key);
        const entry = this.cache.get(fullKey);

        if (entry) {
            entry.expiresAt = ttl ? Date.now() + ttl * 1000 : undefined;
            this.cache.set(fullKey, entry);
            this.cache.set(fullMetadataKey, entry);
        }
    }

    @SecureConnector.AccessControl
    public async getTTL(acRequest: AccessRequest, key: string): Promise<number> {
        const fullKey = this.getFullKey(key);
        const entry = this.cache.get(fullKey);

        if (!entry || !entry.expiresAt) return -1;

        const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
        return remaining > 0 ? remaining : -1;
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        const fullMetadataKey = this.getFullMetadataKey(resourceId);
        const entry = this.cache.get(fullMetadataKey);

        if (!entry) {
            return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
        }

        return ACL.from(entry.metadata?.acl as IACL);
    }

    @SecureConnector.AccessControl
    async getACL(acRequest: AccessRequest, key: string): Promise<IACL> {
        try {
            const metadata = await this.getMetadata(acRequest, key);
            return (metadata?.acl as IACL) || {};
        } catch (error) {
            console.error(`Error getting access rights in RAMCache`, error.name, error.message);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async setACL(acRequest: AccessRequest, key: string, acl: IACL) {
        try {
            let metadata = await this.getMetadata(acRequest, key);
            if (!metadata) metadata = {};
            metadata.acl = ACL.from(acl).addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
            await this.setMetadata(acRequest, key, metadata);
        } catch (error) {
            console.error(`Error setting access rights in RAMCache`, error);
            throw error;
        }
    }

    public async stop() {
        super.stop();
        clearInterval(this.cleanupInterval);
        this.cache.clear();
    }
}
