import { ConnectorService } from '@sre/Core/ConnectorsService';
import { CacheConnector } from './Cache.service/CacheConnector';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { uid } from '@sre/utils/index';

export type LLMCacheObject = {
    ttl: number;
    data: any;
};

export class LLMCache {
    private _cacheConnector: CacheConnector;
    private _cacheId: string;
    private _ttl: number;
    private _candidate: AccessCandidate;

    public get id() {
        return this._cacheId;
    }

    /**
     * Generates a standardized LLM cache key
     * @param id - Identifier to use as cache key (e.g., conversationId, sessionId)
     * @returns LLM cache key with 'llm_cache_' prefix
     */
    public static generateLLMCacheId(id: string): string {
        return `llm_cache:${id}`;
    }

    /**
     * Creates a new LLMCache instace for a smythOS actor, the actor can be an agent, a user or a team
     * This is mainly use with agent to maintain a cache of the current LLM context
     *
     * This class can be used to share llm contexts data accross multiple instances of an agent, or between a ConversationHelper and a remote agent
     *
     * @param candidate
     * @param cacheId
     * @param ttl
     */
    constructor(candidate: AccessCandidate, cacheId?: string, ttl: number = 1 * 60 * 60) {
        this._cacheConnector = ConnectorService.getCacheConnector();
        this._cacheId = cacheId || 'llm_cache_' + uid();
        this._ttl = ttl;
        this._candidate = candidate;
    }

    async set(key: string, data: any) {
        if (!this._cacheConnector.valid) return;

        await this._cacheConnector
            .requester(this._candidate)
            .set(`${this._cacheId}:${key}`, typeof data === 'object' ? JSON.stringify(data) : data, null, null, this._ttl);
    }
    async get(key: string, format: 'json' | 'text' = 'json') {
        if (!this._cacheConnector.valid) return;

        const obj = await this._cacheConnector.requester(this._candidate).get(`${this._cacheId}:${key}`);
        let result;
        if (format === 'json') {
            try {
                result = JSON.parse(obj);
            } catch (e) {
                console.warn(`Invalid JSON data for key ${key}`);
                result = null;
            }
        } else {
            result = obj;
        }
        return result;
    }
    async delete(key: string) {
        if (!this._cacheConnector.valid) return;

        await this._cacheConnector.requester(this._candidate).delete(`${this._cacheId}:${key}`);
    }
    async clear() {
        if (!this._cacheConnector.valid) return;

        await this._cacheConnector.requester(this._candidate).delete(this._cacheId);
    }
}
