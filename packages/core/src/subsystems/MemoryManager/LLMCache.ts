import { ConnectorService } from '@sre/Core/ConnectorsService';
import { CacheConnector } from './Cache.service/index';
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
        await this._cacheConnector.user(this._candidate).set(`${this._cacheId}:${key}`, data, null, null, this._ttl);
    }
    async get(key: string) {
        const obj = await this._cacheConnector.user(this._candidate).get(`${this._cacheId}:${key}`);
        return obj;
    }
    async delete(key: string) {
        await this._cacheConnector.user(this._candidate).delete(`${this._cacheId}:${key}`);
    }
    async clear() {
        await this._cacheConnector.user(this._candidate).delete(this._cacheId);
    }
}
