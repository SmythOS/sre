// Example: agent.vault with default team (no teamId)
//
// When an agent is created without a teamId, it belongs to the "default" team.
// agent.vault reads secrets from the "default" section of your vault.
//
// Expected vault.json (located in your project root or .smyth/vault.json):
// {
//   "default": {
//     "openai": "sk-...",
//     "anthropic": "sk-ant-..."
//   }
// }

import { Agent } from '@smythos/sdk';
import { SRE } from '@smythos/sdk/core';

SRE.init({});

async function main() {
    // No teamId → agent belongs to the "default" vault namespace
    const agent = new Agent({
        id: 'default-agent',
        name: 'Default Team Agent',
        behavior: 'You are a helpful assistant.',
        model: 'gpt-4o-mini',
    });

    // Wait for the vault to finish initializing before using it
    await agent.vault.ready;

    // Reads "default" > "openai" from vault
    const openaiKey = await agent.vault.get('openai');
    console.log('openai key:', openaiKey);

    // List all keys available to this agent's team
    const keys = await agent.vault.listKeys();
    console.log('available keys:', keys);
}

main();
