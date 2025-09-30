import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { LocalStorageCache } from '@sre/MemoryManager/Cache.service/connectors/LocalStorageCache.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';

let tempRoot: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sre-localcache-'));
    setupSRE({
        Cache: {
            Connector: 'LocalStorage',
            Settings: {
                folder: tempRoot,
            },
        },
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

describe('LocalStorageCache - integration (actual connector)', () => {
    it('should set/get/exists/delete roundtrip with ACL ownership', async () => {
        const cache = ConnectorService.getCacheConnector('LocalStorage');
        expect(cache).toBeInstanceOf(LocalStorageCache);

        const user = AccessCandidate.user('cache-user');
        const client = cache.requester(user);

        const key = 'k:alpha';
        const acl = new ACL().addAccess(TAccessRole.Team, 'team-x', TAccessLevel.Read).ACL;
        const metadata = { tag: 'v1' } as any;

        await client.set(key, 'value-1', acl, metadata);
        await expect(client.exists(key)).resolves.toBe(true);
        await expect(client.get(key)).resolves.toBe('value-1');

        const md = await client.getMetadata(key);
        expect(md?.tag).toBe('v1');
        const objAcl = await client.getACL(key);
        expect(ACL.from(objAcl as any).checkExactAccess(user.ownerRequest)).toBe(true);

        await client.delete(key);
        await expect(client.exists(key)).resolves.toBe(false);
        await expect(client.get(key)).resolves.toBeUndefined();
    });

    it('should support TTL expiry and updateTTL/getTTL', async () => {
        const cache = ConnectorService.getCacheConnector('LocalStorage');
        const user = AccessCandidate.user('ttl-user');
        const client = cache.requester(user);

        const key = 'k:ttl';
        await client.set(key, 'temp', undefined, {}, 2); // 1s
        const ttl1 = await client.getTTL(key);
        expect(ttl1).toBeGreaterThan(0);

        await client.updateTTL(key, 4);
        const ttl2 = await client.getTTL(key);
        expect(ttl2).toBeGreaterThanOrEqual(1);

        // Wait for expiry
        await new Promise((r) => setTimeout(r, 4100));
        await expect(client.exists(key)).resolves.toBe(false);
        await expect(client.get(key)).resolves.toBeUndefined();
    });

    it('setMetadata and setACL should update metadata and preserve ownership', async () => {
        const cache = ConnectorService.getCacheConnector('LocalStorage');
        const user = AccessCandidate.user('meta-user');
        const client = cache.requester(user);

        const key = 'k:meta';
        await client.set(key, 'v');

        await client.setMetadata(key, { a: 1 });
        const md1 = await client.getMetadata(key);
        expect(md1?.a).toBe(1);

        const newAcl = new ACL().addAccess(TAccessRole.User, 'other', TAccessLevel.Owner).ACL;
        await client.setACL(key, newAcl);
        const got = await client.getACL(key);
        expect(ACL.from(got as any).checkExactAccess(user.ownerRequest)).toBe(true);
    });

    it('should initialize cache and metadata folders', async () => {
        const cache = ConnectorService.getCacheConnector('LocalStorage');
        const user = AccessCandidate.user('init-user');
        await cache.requester(user).set('init-test', 'value');

        expect(fs.existsSync(path.join(tempRoot, 'cache'))).toBe(true);
        expect(fs.existsSync(path.join(tempRoot, 'cache.metadata'))).toBe(true);
        expect(fs.existsSync(path.join(tempRoot, 'cache.metadata', 'README_IMPORTANT.txt'))).toBe(true);
    });
});
