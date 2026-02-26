import { AccessCandidate, CacheConnector, ConnectorService, DEFAULT_TEAM_ID, ICacheRequest, TConnectorService } from '@smythos/sre';

import { SDKObject } from '../Core/SDKObject.class';
import { TCacheProvider } from '../types/generated/Cache.types';

export class CacheInstance extends SDKObject {
    private _candidate: AccessCandidate;
    private _cacheRequest: ICacheRequest;

    constructor(providerId?: TCacheProvider, cacheSettings: any = {}, candidate?: AccessCandidate) {
        super();
        this._candidate = candidate || AccessCandidate.team(DEFAULT_TEAM_ID);

        let connector = ConnectorService.getCacheConnector(providerId || '');

        if (!connector?.valid) {
            connector = ConnectorService.init(TConnectorService.Cache, providerId, providerId, {});

            if (!connector?.valid) {
                console.error(`Cache connector ${providerId} is not available`);

                throw new Error(`Cache connector ${providerId} is not available`);
            }
        }

        const instance: CacheConnector = connector.instance(cacheSettings || connector.settings);

        this._cacheRequest = instance.requester(this._candidate);
    }

    /**
     * Get a value from the cache
     * @param key - The key to retrieve
     * @returns The value associated with the key
     */
    async get(key: string): Promise<any> {
        return await this._cacheRequest.get(key);
    }

    /**
     * Set a value in the cache
     * @param key - The key to set
     * @param data - The data to store
     * @param ttl - Optional Time To Live in seconds
     * @returns true if successful
     */
    async set(key: string, data: any, ttl?: number): Promise<boolean> {
        // We pass undefined for acl and metadata to hide them from the SDK user
        return await this._cacheRequest.set(key, data, undefined, undefined, ttl);
    }

    /**
     * Delete a value from the cache
     * @param key - The key to delete
     */
    async delete(key: string): Promise<void> {
        await this._cacheRequest.delete(key);
    }

    /**
     * Check if a key exists in the cache
     * @param key - The key to check
     * @returns true if the key exists
     */
    async exists(key: string): Promise<boolean> {
        return await this._cacheRequest.exists(key);
    }

    /**
     * Get the remaining TTL for a key
     * @param key - The key to check
     * @returns The remaining TTL in seconds
     */
    async getTTL(key: string): Promise<number> {
        return await this._cacheRequest.getTTL(key);
    }

    /**
     * Update the TTL for a key
     * @param key - The key to update
     * @param ttl - New Time To Live in seconds
     */
    async updateTTL(key: string, ttl?: number): Promise<void> {
        await this._cacheRequest.updateTTL(key, ttl);
    }
}
