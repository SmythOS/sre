// prettier-ignore-file
import { SRE } from '@smythos/sre';
import { describe, it, beforeAll, expect } from 'vitest';
import { Agent, Storage, Scope } from '../../../src/index';

function uniqueName(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe('Storage - URI behavior', () => {
    beforeAll(async () => {
        SRE.init({});
        await SRE.ready();
    });

    it('returns smythfs uri containing candidate role segment', async () => {
        const agent = new Agent({ id: `agent-${uniqueName('id')}`, teamId: 'team-uri', name: 'Agent', model: 'gpt-4o' });
        const storage = agent.storage.default();
        const filename = uniqueName('role-uri.txt');

        const uri = await storage.write(filename, 'content');
        expect(uri.startsWith('smythfs://')).toBe(true);
        expect(uri.includes('.agent/')).toBe(true); // agent scoped resource
    });

    it('TEAM scoped write returns uri containing .team segment', async () => {
        const agent = new Agent({ id: `agent-${uniqueName('id')}`, teamId: 'team-uri-2', name: 'Agent', model: 'gpt-4o' });
        const storage = agent.storage.default({ scope: Scope.TEAM });
        const filename = uniqueName('team-role-uri.txt');

        const uri = await storage.write(filename, 'content');
        expect(uri.includes('.team/')).toBe(true);
    });

    it('standalone Storage.default uses .team segment (default team when needed)', async () => {
        const storage = Storage.default();
        const filename = uniqueName('standalone-uri.txt');
        const uri = await storage.write(filename, 'x');
        expect(uri.includes('.team/')).toBe(true);
    });
});
