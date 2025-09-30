import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { RedisCache } from '@sre/MemoryManager/Cache.service/connectors/RedisCache.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';

// Note: This test requires a Redis instance running on localhost:6379
// You can skip this test if Redis is not available by setting SKIP_REDIS_TESTS=true

const REDIS_HOST = process.env.REDIS_HOST || 'localhost:6379';
const SKIP_REDIS_TESTS = process.env.SKIP_REDIS_TESTS === 'true';

beforeAll(() => {
    if (SKIP_REDIS_TESTS) {
        console.log('Skipping Redis tests - SKIP_REDIS_TESTS=true');
        return;
    }

    setupSRE({
        Cache: {
            Connector: 'Redis',
            Settings: {
                hosts: REDIS_HOST,
                password: process.env.REDIS_PASSWORD,
            },
        },
        Log: { Connector: 'ConsoleLog' },
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('RedisCache - integration (actual connector)', () => {
    it.skipIf(SKIP_REDIS_TESTS)('should set/get/exists/delete roundtrip with ACL ownership', async () => {
        const cache = ConnectorService.getCacheConnector('Redis');
        expect(cache).toBeInstanceOf(RedisCache);

        const user = AccessCandidate.user('redis-user');
        const client = cache.requester(user);

        const key = 'k:redis:alpha';
        const acl = new ACL().addAccess(TAccessRole.Team, 'team-x', TAccessLevel.Read).ACL;
        const metadata = { tag: 'redis-v1' } as any;

        await client.set(key, 'redis-value-1', acl, metadata);
        await expect(client.exists(key)).resolves.toBe(true);
        await expect(client.get(key)).resolves.toBe('redis-value-1');

        const md = await client.getMetadata(key);
        expect(md?.tag).toBe('redis-v1');
        const objAcl = await client.getACL(key);
        expect(ACL.from(objAcl as any).checkExactAccess(user.ownerRequest)).toBe(true);

        await client.delete(key);
        await expect(client.exists(key)).resolves.toBe(false);
        await expect(client.get(key)).resolves.toBeNull();
    });

    it.skipIf(SKIP_REDIS_TESTS)('should support TTL expiry and updateTTL/getTTL', async () => {
        const cache = ConnectorService.getCacheConnector('Redis');
        const user = AccessCandidate.user('redis-ttl-user');
        const client = cache.requester(user);

        const key = 'k:redis:ttl';
        await client.set(key, 'redis-temp', undefined, {}, 2); // 2s
        const ttl1 = await client.getTTL(key);
        expect(ttl1).toBeGreaterThan(0);

        await client.updateTTL(key, 3);
        const ttl2 = await client.getTTL(key);
        expect(ttl2).toBeGreaterThanOrEqual(2);

        // Wait for expiry
        await new Promise((r) => setTimeout(r, 3100));
        await expect(client.exists(key)).resolves.toBe(false);
        await expect(client.get(key)).resolves.toBeNull();
    });

    it.skipIf(SKIP_REDIS_TESTS)('setMetadata and setACL should update metadata and preserve ownership', async () => {
        const cache = ConnectorService.getCacheConnector('Redis');
        const user = AccessCandidate.user('redis-meta-user');
        const client = cache.requester(user);

        const key = 'k:redis:meta';
        await client.set(key, 'redis-v');

        await client.setMetadata(key, { redisField: 1 });
        const md1 = await client.getMetadata(key);
        expect(md1?.redisField).toBe(1);

        const newAcl = new ACL().addAccess(TAccessRole.User, 'other', TAccessLevel.Owner).ACL;
        await client.setACL(key, newAcl);
        const got = await client.getACL(key);
        expect(ACL.from(got as any).checkExactAccess(user.ownerRequest)).toBe(true);
    });

    it.skipIf(SKIP_REDIS_TESTS)('should handle Redis client connection', async () => {
        const cache = ConnectorService.getCacheConnector('Redis') as RedisCache;
        expect(cache.client).toBeDefined();
        expect(cache.prefix).toBe('smyth:cache');
        expect(cache.mdPrefix).toBe('smyth:metadata');
    });
});
