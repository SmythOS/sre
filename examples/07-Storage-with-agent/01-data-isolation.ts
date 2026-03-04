import { Agent, Scope } from '@smythos/sdk';

const agentNeo = new Agent({
    id: 'agent-neo',
    teamId: 'the-matrix',
    name: 'Agent Neo',
    behavior: 'You are a helpful assistant that can answer questions and help with tasks.',
    model: 'gpt-4o',
});

const agentTrinity = new Agent({
    id: 'agent-trinity',
    teamId: 'the-matrix',
    name: 'Agent Trinity',
    behavior: 'You are a helpful assistant that can answer questions and help with tasks.',
    model: 'gpt-4o',
});

//in this first part, the scopes are isolated because we use the default storage scope

//here we will use SRE default storage
const NeoStorage = agentNeo.storage.default();
const TrinityStorage = agentTrinity.storage.default();

// but we could also explicitly specify the storage that we want to use
//const NeoStorage = agentNeo.storage.LocalStorage({/*... S3 settings ...*/});
//const TrinityStorage = agentTrinity.storage.LocalStorage({/*... S3 settings ...*/});
// or using S3
//const NeoStorage = agentNeo.storage.S3({/*... S3 settings ...*/});
//const TrinityStorage = agentTrinity.storage.S3({/*... S3 settings ...*/});

await NeoStorage.write('neo.txt', 'Hello, Neo!');

const neo_data = await NeoStorage.read('neo.txt');
const trinity_data = await TrinityStorage.read('neo.txt');

console.log('Neo reading neo.txt', neo_data?.toString()); //data = 'Hello, Neo!'
console.log('Trinity reading neo.txt', trinity_data?.toString()); //data is empty

//in this second part, the scopes are shared because we explicitly set the scope to Scope.TEAM
//this means that all the agents in the same team share the same storage
const neoSharedStorage = agentNeo.storage.default({ scope: Scope.TEAM });
const trinitySharedStorage = agentTrinity.storage.default({ scope: Scope.TEAM });

await neoSharedStorage.write('team.txt', 'Hello, Team!');

const neo_data2 = await neoSharedStorage.read('team.txt');
const trinity_data2 = await trinitySharedStorage.read('team.txt');

console.log('Neo reading neo.txt', neo_data2?.toString()); //data = 'Hello, Team!'
console.log('Trinity reading neo.txt', trinity_data2?.toString()); //data = 'Hello, Team!'
