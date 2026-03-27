import { Logger } from '@sre/helpers/Log.helper';
import { IAccessCandidate, IACL, TAccessLevel } from '@sre/types/ACL.types';
import { CacheMetadata } from '@sre/types/Cache.types';
import { CacheConnector } from '../CacheConnector';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';

import memjs, { Client } from 'memjs';
import { MemcachedConfig } from '@sre/types/Memcached.types';


const console = Logger('MemcachedCache');


export class MemcachedCache extends CacheConnector {
    public name: string = 'MemcachedCache';
    private memcached: Client;
    private _prefix: string;
    private _mdPrefix: string;

    constructor(protected _settings: MemcachedConfig) {
        super(_settings);

        const hosts = Array.isArray(_settings.hosts)
            ? _settings.hosts
                  .map((h) => (typeof h === 'string' ? h : `${h.host}:${h.port}`))
                  .join(',')
            : typeof _settings.hosts === 'string'
            ? _settings.hosts
            : '';

        this.memcached = memjs.Client.create(hosts, {
            username: _settings.username,
            password: _settings.password,
        });

        this._prefix = _settings.prefix || 'smyth:cache';
        this._mdPrefix = _settings.metadataPrefix || 'smyth:metadata';

        console.log(`Memcached connected: ${hosts}`);
    }

    public get client() {
        return this.memcached;
    }

    public get prefix() {
        return this._prefix;
    }

    public get mdPrefix() {
        return this._mdPrefix;
    }

@SecureConnector.AccessControl
public async get(acRequest: AccessRequest, key: string): Promise<string | null> {
    const cacheKey = `${this._prefix}:${key}`;
    const mdKey = `${this._mdPrefix}:${key}`;

    const { value } = await this.memcached.get(cacheKey);
    if (!value) return null;

    const { value: mdValue } = await this.memcached.get(mdKey);
    let metadata: CacheMetadata | undefined;
    if (mdValue) {
        metadata = this.deserializeMetadata(mdValue.toString());
    }

    if (metadata?.expiresAt && metadata.expiresAt < Date.now()) {
        await Promise.all([
            this.memcached.delete(cacheKey),
            this.memcached.delete(mdKey),
        ]);
        return null;
    }

    return value.toString();
}

    @SecureConnector.AccessControl
    public async set(
        acRequest: AccessRequest,
        key: string,
        data: any,
        acl?: IACL,
        metadata?: CacheMetadata,
        ttl?: number
    ): Promise<boolean> {
        const accessCandidate = acRequest.candidate;
        const newMetadata: CacheMetadata = metadata || {};
        newMetadata.acl = ACL.from(acl).addAccess(
            accessCandidate.role,
            accessCandidate.id,
            TAccessLevel.Owner
        ).ACL;

        if (ttl) {
            newMetadata.expiresAt = Date.now() + ttl * 1000;
        }

        await Promise.all([
            this.memcached.set(`${this._prefix}:${key}`, Buffer.from(String(data)), { expires: ttl || 0 }),
            this.memcached.set(`${this._mdPrefix}:${key}`, Buffer.from(this.serializeMetadata(newMetadata)), { expires: ttl || 0 }),
        ]);

        return true;
    }

    @SecureConnector.AccessControl
    public async delete(acRequest: AccessRequest, key: string): Promise<void> {
        await Promise.all([
            this.memcached.delete(`${this._prefix}:${key}`),
            this.memcached.delete(`${this._mdPrefix}:${key}`),
        ]);
    }

    @SecureConnector.AccessControl
    public async exists(acRequest: AccessRequest, key: string): Promise<boolean> {
        const { value } = await this.memcached.get(`${this._prefix}:${key}`);
        return !!value;
    }

    @SecureConnector.AccessControl
    public async getMetadata(acRequest: AccessRequest, key: string): Promise<CacheMetadata | undefined> {
        const { value } = await this.memcached.get(`${this._mdPrefix}:${key}`);
        if (!value) return undefined;
        return this.deserializeMetadata(value.toString());
    }

    @SecureConnector.AccessControl
    public async setMetadata(acRequest: AccessRequest, key: string, metadata: CacheMetadata): Promise<void> {
        await this.memcached.set(`${this._mdPrefix}:${key}`, Buffer.from(this.serializeMetadata(metadata)));
    }

public async updateTTL(acRequest: AccessRequest, key: string, ttl?: number): Promise<void> {
  if (!ttl) return;

  const namespacedKey = `${this._prefix}:${key}`;
  const namespacedMdKey = `${this._mdPrefix}:${key}`;

  const { value } = await this.memcached.get(namespacedKey);
  const { value: md } = await this.memcached.get(namespacedMdKey);

  if (value) {
    await this.memcached.set(namespacedKey, value, { expires: ttl });
  }

  if (md) {
    const metadata = JSON.parse(this.serializeMetadata(md));
    metadata.expiresAt = Date.now() + ttl * 1000;
    await this.memcached.set(namespacedMdKey, JSON.stringify(metadata), { expires: ttl });
  }
}


    @SecureConnector.AccessControl
    public async getTTL(acRequest: AccessRequest, key: string): Promise<number> {
        // Memcached does not support direct TTL querying like Redis
        // so we store expiresAt inside metadata
        const metadata = await this.getMetadata(acRequest, key);
        if (!metadata?.expiresAt) return -1;
        return Math.max(0, Math.floor((metadata.expiresAt - Date.now()) / 1000));
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        const { value } = await this.memcached.get(`${this._mdPrefix}:${resourceId}`);
        if (!value) {
            return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
        }
        const metadata = this.deserializeMetadata(value.toString());
        return ACL.from(metadata?.acl as IACL);
    }

    @SecureConnector.AccessControl
    async getACL(acRequest: AccessRequest, key: string): Promise<IACL | undefined> {
        const metadata = await this.getMetadata(acRequest, key);
        return metadata?.acl as IACL;
    }

    @SecureConnector.AccessControl
    async setACL(acRequest: AccessRequest, key: string, acl: IACL) {
        let metadata = (await this.getMetadata(acRequest, key)) || {};
        metadata.acl = ACL.from(acl).addAccess(
            acRequest.candidate.role,
            acRequest.candidate.id,
            TAccessLevel.Owner
        ).ACL;
        await this.setMetadata(acRequest, key, metadata);
    }

    private serializeMetadata(metadata: CacheMetadata): string {
        const cloned = { ...metadata };
        if (cloned.acl) cloned.acl = ACL.from(cloned.acl).serializedACL;
        if (metadata.expiresAt) cloned.expiresAt = metadata.expiresAt;
        return JSON.stringify(cloned);
    }

    private deserializeMetadata(str: string): CacheMetadata {
        try {
            const obj = JSON.parse(str);
            if (obj.acl) obj.acl = ACL.from(obj.acl).ACL;
            return obj;
        } catch (e) {
            console.warn('Error deserializing metadata', str);
            return {};
        }
    }

    public async stop() {
        super.stop();
        await this.memcached.quit();
    }
}
