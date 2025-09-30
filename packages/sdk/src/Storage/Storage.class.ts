import { AccessCandidate, DEFAULT_TEAM_ID } from '@smythos/sre';

import { HELP } from '../utils/help';
import { TStorageProvider, TStorageProviderInstances } from '../types/generated/Storage.types';
import { Scope } from '../types/SDKTypes';
import { StorageInstance } from './StorageInstance.class';

/**
 * Storage instance factory functions for each storage provider.
 *
 * @example
 * ```typescript
 * const storage = Storage.LocalStorage();
 * storage.write('test.txt', 'Hello, world!');
 * ```
 * @namespace Storage
 */
const Storage: TStorageProviderInstances = {} as TStorageProviderInstances;

//generate a storage instance entry for every available storage provider
for (const provider of Object.keys(TStorageProvider)) {
    Storage[provider] = (storageSettings?: any, scope?: Scope | AccessCandidate) => {
        const { scope: _scope, ...connectorSettings } = storageSettings || {};
        if (!scope) scope = _scope;
        let candidate: AccessCandidate;
        if (typeof scope === 'string') {
            let message = `You are trying to use an agent scope in a standalone storage instance.`;
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
        return new StorageInstance(TStorageProvider[provider], connectorSettings, candidate);
    };
}

export { Storage };
