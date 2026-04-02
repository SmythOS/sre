// Example: vault fallback to a shared namespace
//
// When `Settings.shared` is set, any key not found in the team's own namespace
// is looked up in the shared (fallback) namespace.
//
// vault.fake.json structure:
//   "default": { "openai": "...", "DIFFBOT_API": "THIS_IS_A_FAKE_DIFFBOT_API_KEY", ... }
//   "Team2":   { "openai": "...", "team2-secret": "team2-secret-value", ... }
//
// "DIFFBOT_API" exists only in "default", not in "Team2" — ideal for testing fallback.
//
// Run the companion script to see the no-fallback behavior:
//   pnpm exec tsx 15-vault/04b-vault-no-fallback.ts

import { Team } from '@smythos/sdk';
import { SRE } from '@smythos/sdk/core';

SRE.init({
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: '../packages/core/tests/data/vault.fake.json',
            shared: 'default', // keys missing from a team fall back to "default"
        },
    },
});

async function main() {
    console.log('--- With shared = "default" ---');

    const team = new Team('Team2');
    await team.vault.ready;

    // "DIFFBOT_API" is not in "Team2" but is in "default" → fallback returns it
    const diffbotKey = await team.vault.get('DIFFBOT_API');
    console.log('DIFFBOT_API (via fallback):', diffbotKey); // "THIS_IS_A_FAKE_DIFFBOT_API_KEY"

    // "team2-secret" is directly in "Team2" — no fallback needed
    const team2Secret = await team.vault.get('team2-secret');
    console.log('team2-secret (direct):', team2Secret); // "team2-secret-value"
}

main();
