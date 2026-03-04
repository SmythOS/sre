import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { RedisCache } from '@sre/MemoryManager/Cache.service/connectors/RedisCache.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';

// Mock ioredis client
vi.mock('ioredis', () => {
    const store = new Map<string, string>();
    return {
        default: class IORedisMock {
            async get(key: string) {
                return store.get(key) ?? null;
            }
            async set(key: string, value: string, ex?: string, ttl?: number) {
                store.set(key, value);
            }
            async del(key: string) {
                store.delete(key);
            }
            async exists(key: string) {
                return store.has(key) ? 1 : 0;
            }
            async expire(key: string, ttl: number) {
                // no-op for unit tests (TTL not enforced in mock)
            }
            async ttl(key: string) {
                return 10;
            }
            async quit() {}
            on() {}
        },
    };
});

beforeAll(() => {
    setupSRE({
        Cache: { Connector: 'Redis', Settings: { hosts: 'localhost:6379', name: 'mymaster' } },
        Log: { Connector: 'ConsoleLog' },
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('RedisCache - unit (mocked ioredis)', () => {
    it('set/get/exists/delete with ACL ownership', async () => {
        const cache = ConnectorService.getCacheConnector('Redis');
        expect(cache).toBeInstanceOf(RedisCache);
        const user = AccessCandidate.user('u1');
        const client = cache.requester(user);

        const key = 'unit:alpha';
        const acl = new ACL().addAccess(TAccessRole.Team, 'team-x', TAccessLevel.Read).ACL;
        await client.set(key, 'val', acl, { m: 1 });
        await expect(client.exists(key)).resolves.toBe(true);
        await expect(client.get(key)).resolves.toBe('val');
        const md = await client.getMetadata(key);
        expect(md).toBeDefined();
        const gotAcl = await client.getACL(key);
        expect(ACL.from(gotAcl as any).checkExactAccess(user.ownerRequest)).toBe(true);

        await client.delete(key);
        await expect(client.exists(key)).resolves.toBe(false);
        await expect(client.get(key)).resolves.toBeNull();
    });

    it('TTL/updateTTL/getTTL mocked semantics', async () => {
        const cache = ConnectorService.getCacheConnector('Redis');
        const user = AccessCandidate.user('u2');
        const client = cache.requester(user);
        const key = 'unit:ttl';
        await client.set(key, 'temp', undefined, {}, 1);
        const t1 = await client.getTTL(key);
        expect(t1).toBeGreaterThanOrEqual(0);
        await client.updateTTL(key, 2);
        const t2 = await client.getTTL(key);
        expect(t2).toBeGreaterThanOrEqual(0);
    });
});
