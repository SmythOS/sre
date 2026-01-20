import { AccessCandidate, DEFAULT_TEAM_ID } from '@smythos/sre';

import { HELP } from '../utils/help';
import { TCacheProvider, TCacheProviderInstances } from '../types/generated/Cache.types';
import { Scope } from '../types/SDKTypes';
import { CacheInstance } from './CacheInstance.class';

/**
 * Cache instance factory functions for each cache provider.
 *
 * @example
 * ```typescript
 * const cache = Cache.Redis();
 * await cache.set('key', 'value');
 * ```
 * @namespace Cache
 */
const Cache: TCacheProviderInstances = {} as TCacheProviderInstances;

//generate a cache instance entry for every available cache provider
for (const provider of Object.keys(TCacheProvider)) {
    Cache[provider] = (cacheSettings?: any, scope?: Scope | AccessCandidate) => {
        const { scope: _scope, ...connectorSettings } = cacheSettings || {};
        if (!scope) scope = _scope;
        let candidate: AccessCandidate;
        if (typeof scope === 'string') {
            let message = `You are trying to use an agent scope in a standalone cache instance.`;
            if (scope === Scope.AGENT) {
                message += `Use AccessCandidate.agent(agentId) if you want to set an agent scope explicitly.`;
            }
            if (scope === Scope.TEAM) {
                message += `Use AccessCandidate.team(teamId) if you want to set a team scope explicitly.`;
            }

            message += `\nI will use default team scope in this session. ${HELP.SDK.AGENT_STORAGE_ACCESS}`;

            console.warn(message);

            candidate = AccessCandidate.team(DEFAULT_TEAM_ID);
        } else {
            candidate = scope as AccessCandidate;
        }
        return new CacheInstance(TCacheProvider[provider], connectorSettings, candidate);
    };
}

export { Cache };
