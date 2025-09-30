// prettier-ignore-file
import { SRE } from '@smythos/sre';
import { describe, it, beforeAll, expect } from 'vitest';
import { Agent, Scope } from '../../../src/index';

function uniqueName(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe('Storage - Agent scoped vs Team scoped', () => {
    beforeAll(async () => {
        SRE.init({});
        await SRE.ready();
    });

    it('isolates resources per agent by default', async () => {
        const agentNeo = new Agent({ id: `neo-${uniqueName('id')}`, teamId: 'the-matrix', name: 'Neo', model: 'gpt-4o' });
        const agentTrinity = new Agent({ id: `trinity-${uniqueName('id')}`, teamId: 'the-matrix', name: 'Trinity', model: 'gpt-4o' });

        const neoStorage = agentNeo.storage.default();
        const trinityStorage = agentTrinity.storage.default();

        const filename = uniqueName('agent-isolated.txt');
        const content = 'Agent isolated data';
        await neoStorage.write(filename, content);

        const neoData = await neoStorage.read(filename);
        const trinityData = await trinityStorage.read(filename);

        expect(neoData?.toString()).toBe(content);
        expect(trinityData).toBeNull();
    });

    it('shares resources when scope is TEAM', async () => {
        const agentNeo = new Agent({ id: `neo-${uniqueName('id')}`, teamId: 'the-matrix', name: 'Neo', model: 'gpt-4o' });
        const agentTrinity = new Agent({ id: `trinity-${uniqueName('id')}`, teamId: 'the-matrix', name: 'Trinity', model: 'gpt-4o' });

        const neoStorage = agentNeo.storage.default({ scope: Scope.TEAM });
        const trinityStorage = agentTrinity.storage.default({ scope: Scope.TEAM });

        const filename = uniqueName('team-shared.txt');
        const content = 'Team shared data';
        await neoStorage.write(filename, content);

        const neoData = await neoStorage.read(filename);
        const trinityData = await trinityStorage.read(filename);

        expect(neoData?.toString()).toBe(content);
        expect(trinityData?.toString()).toBe(content);
    });

    it('read/write using returned smythfs uri across same-scope instances', async () => {
        const agent = new Agent({ id: `agent-${uniqueName('id')}`, teamId: 'team-abc', name: 'Agent', model: 'gpt-4o' });
        const storageA = agent.storage.default();
        const storageB = agent.storage.default();

        const filename = uniqueName('uri-cross.txt');
        const content = 'URI cross instance';
        const uri = await storageA.write(filename, content);

        const data = await storageB.read(uri);
        expect(data?.toString()).toBe(content);
    });
});
