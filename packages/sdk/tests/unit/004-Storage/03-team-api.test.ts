// prettier-ignore-file
import { SRE } from '@smythos/sre';
import { describe, it, beforeAll, expect } from 'vitest';
import { Team } from '../../../src/index';

function uniqueName(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe('Storage - Team API access', () => {
    beforeAll(async () => {
        SRE.init({});
        await SRE.ready();
    });

    it('team.storage.default creates team-scoped resources', async () => {
        const team = new Team('team-zion');
        const storage = team.storage.default();

        const filename = uniqueName('team-default.txt');
        const content = 'Team API default storage';

        const uri = await storage.write(filename, content);
        expect(uri).toMatch(/^smythfs:\/\//);

        const data = await storage.read(filename);
        expect(data?.toString()).toBe(content);
    });

    it('team.storage.LocalStorage works with explicit provider', async () => {
        const team = new Team('team-zion-2');
        const storage = team.storage.LocalStorage();

        const filename = uniqueName('team-local.txt');
        const content = 'Team LocalStorage';

        await storage.write(filename, content);
        const data = await storage.read(filename);
        expect(data?.toString()).toBe(content);
    });
});
