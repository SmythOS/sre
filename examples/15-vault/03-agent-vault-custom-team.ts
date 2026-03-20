// Example: team.vault + agent.vault sharing the same namespace, and cross-team isolation
//
// team.vault and agent.vault (when the agent belongs to that team) read from
// the same vault namespace — the team id.  A different team cannot access
// another team's secrets.
//
// Uses vault.fake.json which contains:
// {
//   "default": { "openai": "sk-proj-...", "DIFFBOT_API": "...", ... },
//   "Team2":   { "openai": "sk-proj-team2-...", "team2-secret": "team2-secret-value", ... }
// }

import { Agent, Team } from '@smythos/sdk';
import { SRE } from '@smythos/sdk/core';

SRE.init({
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: '../packages/core/tests/data/vault.fake.json',
        },
    },
});

async function main() {
    // --- Team2 ---
    const team2 = new Team('Team2');
    await team2.vault.ready;

    const team2Secret = await team2.vault.get('team2-secret').catch(() => undefined);
    console.log('[Team2] team2-secret:', team2Secret); // "team2-secret-value"

    const team2Keys = await team2.vault.listKeys().catch(() => []);
    console.log('[Team2] keys:', team2Keys); // ["echo", "openai", "anthropic", "team2-secret", ...]

    // An agent in Team2 reads from the same namespace via agent.vault
    const agentTeam2 = team2.addAgent({
        id: 'team2-agent',
        name: 'Team2 Agent',
        behavior: 'You are a helpful assistant.',
        model: 'gpt-4o-mini',
    });

    await agentTeam2.vault.ready;
    const agentTeam2Secret = await agentTeam2.vault.get('team2-secret').catch(() => undefined);
    console.log('[team2-agent] team2-secret:', agentTeam2Secret); // same value as above

    // --- default team (isolation) ---
    const defaultTeam = new Team('default');
    await defaultTeam.vault.ready;

    // default team cannot read Team2's secrets
    const crossTeamRead = await defaultTeam.vault.get('team2-secret').catch(() => undefined);
    console.log('[default] team2-secret (should be undefined):', crossTeamRead); // undefined

    const defaultKeys = await defaultTeam.vault.listKeys().catch(() => []);
    console.log('[default] keys:', defaultKeys); // ["openai", "DIFFBOT_API", "my-key", ...]
}

main();
