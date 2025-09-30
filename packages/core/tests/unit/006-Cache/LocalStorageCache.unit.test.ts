import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { LocalStorageCache } from '@sre/MemoryManager/Cache.service/connectors/LocalStorageCache.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';

let tempRoot: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sre-lsc-unit-'));
    setupSRE({
        Cache: { Connector: 'LocalStorage', Settings: { folder: tempRoot } },
        Log: { Connector: 'ConsoleLog' },
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

afterAll(() => {
    try {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {}
});

describe('LocalStorageCache - unit (temp fs)', () => {
    it('set/get/exists/delete + ACL', async () => {
        const cache = ConnectorService.getCacheConnector('LocalStorage');
        expect(cache).toBeInstanceOf(LocalStorageCache);
        const user = AccessCandidate.user('u1');
        const client = cache.requester(user);

        const key = 'unit/alpha';
        const acl = new ACL().addAccess(TAccessRole.Team, 'team-x', TAccessLevel.Read).ACL;
        await client.set(key, 'value', acl, { meta: 1 });
        await expect(client.exists(key)).resolves.toBe(true);
        await expect(client.get(key)).resolves.toBe('value');
        const md = await client.getMetadata(key);
        expect(md?.meta).toBe(1);
        const gotAcl = await client.getACL(key);
        expect(ACL.from(gotAcl as any).checkExactAccess(user.ownerRequest)).toBe(true);

        await client.delete(key);
        await expect(client.exists(key)).resolves.toBe(false);
        await expect(client.get(key)).resolves.toBeUndefined();
    });

    it('TTL and updateTTL/getTTL', async () => {
        const cache = ConnectorService.getCacheConnector('LocalStorage');
        const user = AccessCandidate.user('u2');
        const client = cache.requester(user);
        const key = 'unit/ttl';
        await client.set(key, 'temp', undefined, {}, 3);
        const t1 = await client.getTTL(key);
        expect(t1).toBeGreaterThan(0);
        await client.updateTTL(key, 4);
        const t2 = await client.getTTL(key);
        expect(t2).toBeGreaterThanOrEqual(1);
        await new Promise((r) => setTimeout(r, 4100));
        await expect(client.exists(key)).resolves.toBe(false);
        await expect(client.get(key)).resolves.toBeUndefined();
    });
});
