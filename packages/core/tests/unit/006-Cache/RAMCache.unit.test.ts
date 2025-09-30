import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { RAMCache } from '@sre/MemoryManager/Cache.service/connectors/RAMCache.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';

beforeAll(() => {
    setupSRE({
        Cache: { Connector: 'RAM' },
        Log: { Connector: 'ConsoleLog' },
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('RAMCache - unit (in-memory behavior, no external deps)', () => {
    it('set/get/exists/delete with ACL ownership', async () => {
        const cache = ConnectorService.getCacheConnector('RAM');
        expect(cache).toBeInstanceOf(RAMCache);
        const user = AccessCandidate.user('u1');
        const client = cache.requester(user);

        const key = 'unit:alpha';
        const acl = new ACL().addAccess(TAccessRole.Team, 'team-x', TAccessLevel.Read).ACL;
        await client.set(key, 'val', acl, { m: 1 });
        await expect(client.exists(key)).resolves.toBe(true);
        await expect(client.get(key)).resolves.toBe('val');
        const md = await client.getMetadata(key);
        expect(md?.m).toBe(1);
        const gotAcl = await client.getACL(key);
        expect(ACL.from(gotAcl as any).checkExactAccess(user.ownerRequest)).toBe(true);

        await client.delete(key);
        await expect(client.exists(key)).resolves.toBe(false);
        await expect(client.get(key)).resolves.toBeNull();
    });

    it('TTL flow with updateTTL/getTTL', async () => {
        const cache = ConnectorService.getCacheConnector('RAM');
        const user = AccessCandidate.user('u2');
        const client = cache.requester(user);
        const key = 'unit:ttl';
        await client.set(key, 'temp', undefined, {}, 1);
        const t1 = await client.getTTL(key);
        expect(t1).toBeGreaterThan(0);
        await client.updateTTL(key, 2);
        const t2 = await client.getTTL(key);
        expect(t2).toBeGreaterThanOrEqual(1);
        await new Promise((r) => setTimeout(r, 2100));
        await expect(client.exists(key)).resolves.toBe(false);
        await expect(client.get(key)).resolves.toBeNull();
    });

    it('setMetadata merges and setACL preserves owner', async () => {
        const cache = ConnectorService.getCacheConnector('RAM');
        const user = AccessCandidate.user('u3');
        const client = cache.requester(user);
        const key = 'unit:meta';
        await client.set(key, 'v', undefined, { a: 1 });
        await client.setMetadata(key, { b: 2 });
        const md = await client.getMetadata(key);
        expect(md?.a).toBe(1);
        expect(md?.b).toBe(2);
        const otherAcl = new ACL().addAccess(TAccessRole.User, 'other', TAccessLevel.Owner).ACL;
        await client.setACL(key, otherAcl);
        const got = await client.getACL(key);
        expect(ACL.from(got as any).checkExactAccess(user.ownerRequest)).toBe(true);
    });
});
