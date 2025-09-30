import { AccessCandidate, DEFAULT_TEAM_ID } from '@smythos/sre';

import { HELP } from '../utils/help';
import { TVectorDBProvider, TVectorDBProviderInstances } from '../types/generated/VectorDB.types';
import { Scope } from '../types/SDKTypes';
import { VectorDBInstance } from './VectorDBInstance.class';

const VectorDB: TVectorDBProviderInstances = {} as TVectorDBProviderInstances;

//generate a VectorDB instance entry for every available VectorDB provider
for (const provider of Object.keys(TVectorDBProvider)) {
    VectorDB[provider] = (namespace: string, VectorDBSettings?: any, scope?: Scope | AccessCandidate) => {
        const { scope: _scope, ...connectorSettings } = VectorDBSettings || {};
        if (!scope) scope = _scope;

        let candidate: AccessCandidate;
        if (typeof scope === 'string') {
            let message = `You are trying to use an agent scope in a standalone VectorDB instance.`;
            if (scope === Scope.AGENT) {
                message += `Use AccessCandidate.agent(agentId) if you want to set an agent scope explicitly.`;
            }
            if (scope === Scope.TEAM) {
                message += `Use AccessCandidate.team(teamId) if you want to set a team scope explicitly.`;
            }

            message += `\nI will use default team scope in this session. ${HELP.SDK.AGENT_VECTORDB_ACCESS}`;

            console.warn(message);

            candidate = AccessCandidate.team(DEFAULT_TEAM_ID);
        } else {
            candidate = scope as AccessCandidate;
        }

        return new VectorDBInstance(TVectorDBProvider[provider], { ...connectorSettings, namespace }, candidate);
    };
}

export { VectorDB };
