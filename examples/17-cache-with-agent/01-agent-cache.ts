import { Agent, Scope } from '@smythos/sdk';

// We must provide explicit IDs to enable agent-scoped isolation.
// Without explicit IDs, the SDK defaults to Team scope to prevent data loss across restarts.
const agent1 = new Agent({ id: 'agent-1', name: 'Agent1', model: 'gpt-4o' });
const agent2 = new Agent({ id: 'agent-2', name: 'Agent2', model: 'gpt-4o' });

// Agent 1 sets a value
await agent1.cache.default().set('secret', 'agent1-secret');

// Agent 2 tries to read it (should fail or return nothing if isolated)
try {
    const val2 = await agent2.cache.default().get('secret');
    console.log('Agent 2 reading Agent 1 secret:', val2); // Expected: undefined or error
} catch (error) {
    console.log('Agent 2 Access Denied (Expected):', error.message);
}

// Agent 1 reads it
const val1 = await agent1.cache.default().get('secret');
console.log('Agent 1 reading secret:', val1); // Expected: agent1-secret

// Shared Team Cache
// Both agents are in default team unless specified otherwise
// Accessing cache via team
const teamCache1 = agent1.team.cache.default();
await teamCache1.set('team-secret', 'shared-secret');

const teamCache2 = agent2.team.cache.default();
const sharedVal = await teamCache2.get('team-secret');
console.log('Agent 2 reading shared secret:', sharedVal); // Expected: shared-secret
