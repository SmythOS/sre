import { AccessCandidate, DEFAULT_TEAM_ID } from '@smythos/sre';

import { HELP } from '../utils/help';
import { TSchedulerProvider, TSchedulerProviderInstances } from '../types/generated/Scheduler.types';
import { Scope } from '../types/SDKTypes';
import { SchedulerInstance } from './SchedulerInstance.class';

/**
 * Scheduler instance factory functions for each scheduler provider.
 *
 * @example
 * ```typescript
 * // Use default scheduler
 * const scheduler = Scheduler.default();
 *
 * // Use LocalScheduler with custom settings
 * const scheduler = Scheduler.LocalScheduler({
 *   folder: './my-scheduler',
 *   autoStart: true
 * });
 * ```
 * @namespace Scheduler
 */
const Scheduler: TSchedulerProviderInstances = {} as TSchedulerProviderInstances;

// Generate a scheduler instance entry for every available scheduler provider
for (const provider of Object.keys(TSchedulerProvider)) {
    Scheduler[provider] = (schedulerSettings?: any, scope?: Scope | AccessCandidate) => {
        const { scope: _scope, ...connectorSettings } = schedulerSettings || {};
        if (!scope) scope = _scope;

        let candidate: AccessCandidate;

        if (typeof scope === 'string') {
            let message = `You are trying to use a scoped scheduler in a standalone instance.`;

            if (scope === Scope.AGENT) {
                message += ` Use AccessCandidate.agent(agentId) if you want to set an agent scope explicitly.`;
            }
            if (scope === Scope.TEAM) {
                message += ` Use AccessCandidate.team(teamId) if you want to set a team scope explicitly.`;
            }

            message += `\nI will use default team scope in this session. ${HELP.SDK.AGENT_STORAGE_ACCESS}`;

            console.warn(message);

            candidate = AccessCandidate.team(DEFAULT_TEAM_ID);
        } else {
            candidate = scope as AccessCandidate;
        }

        return new SchedulerInstance(TSchedulerProvider[provider], connectorSettings, candidate);
    };
}

export { Scheduler };
