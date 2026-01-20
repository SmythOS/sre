import { Agent, Scope } from '@smythos/sdk';

const agentNeo = new Agent({
    id: 'agent-neo',
    teamId: 'the-matrix',
    name: 'Agent Neo',
    model: 'gpt-4o',
});

const agentTrinity = new Agent({
    id: 'agent-trinity',
    teamId: 'the-matrix',
    name: 'Agent Trinity',
    model: 'gpt-4o',
});

// 1. Explicit Agent Scope (Isolated)
// Even if we don't specify the scope, it defaults to Agent scope because the agents have IDs.
// But we can be explicit about it.
console.log('--- Explicit Agent Scope (Isolated) ---');
const neoCache = agentNeo.cache.default({ scope: Scope.AGENT });
await neoCache.set('mission', 'Follow the white rabbit');

try {
    const trinityRead = await agentTrinity.cache.default({ scope: Scope.AGENT }).get('mission');
    console.log('Trinity reading Neo mission:', trinityRead);
} catch (e) {
    console.log('Trinity cannot read Neo mission (Expected Access Denied):', e.message);
}

// 2. Explicit Team Scope (Shared)
// We can force the cache instance to use the Team scope, allowing sharing between agents in the same team.
console.log('\n--- Explicit Team Scope (Shared) ---');
const neoSharedCache = agentNeo.cache.default({ scope: Scope.TEAM });
await neoSharedCache.set('target', 'The Source');

const trinitySharedCache = agentTrinity.cache.default({ scope: Scope.TEAM });
const sharedTarget = await trinitySharedCache.get('target');

console.log('Neo wrote target:', 'The Source');
console.log('Trinity reading target (Scope.TEAM):', sharedTarget); // Expected: The Source
