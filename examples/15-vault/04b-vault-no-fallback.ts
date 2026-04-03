// Example: vault without a shared fallback namespace
//
// Without `Settings.shared`, each team only sees its own keys.
// A key that exists in "default" is NOT visible to other teams.
//
// Compare with 04-vault-fallback-behavior.ts which enables `shared: "default"`.

import { Team } from '@smythos/sdk';
import { SRE } from '@smythos/sdk/core';

SRE.init({
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: '../packages/core/tests/data/vault.fake.json',
            // no shared — each team is fully isolated
        },
    },
});

async function main() {
    console.log('--- Without shared namespace ---');

    const team = new Team('Team2');
    await team.vault.ready;

    // "DIFFBOT_API" exists in "default" but NOT in "Team2" → undefined (no fallback)
    const diffbotKey = await team.vault.get('DIFFBOT_API').catch(() => undefined);
    console.log('DIFFBOT_API (no fallback):', diffbotKey); // undefined

    // "team2-secret" is directly in "Team2" — still accessible
    const team2Secret = await team.vault.get('team2-secret');
    console.log('team2-secret (direct):', team2Secret); // "team2-secret-value"
}

main();
