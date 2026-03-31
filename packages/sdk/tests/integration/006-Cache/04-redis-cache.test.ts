// prettier-ignore-file
/**
 * Cache.Redis() integration — requires a Redis server.
 *
 * Env vars:
 *   REDIS_URL (e.g. redis://localhost:6379)
 *
 * RedisConfig expects: { name, password, hosts }
 * Parse REDIS_URL into the expected format.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Cache } from '../../../src/index';
import { initSRE, HAS_REDIS } from '../_helpers';

function parseRedisUrl(): { name: string; password: string; hosts: string } {
    const url = process.env.REDIS_URL || '';
    try {
        const parsed = new URL(url);
        return {
            name: 'integration-test',
            password: parsed.password || '',
            hosts: `${parsed.hostname}:${parsed.port || '6379'}`,
        };
    } catch {
        return { name: 'integration-test', password: '', hosts: url };
    }
}

describe.skipIf(!HAS_REDIS)('Cache - Redis integration', () => {
    beforeAll(() => initSRE());

    it('set/get/delete cycle', async () => {
        const cache = Cache.Redis(parseRedisUrl());
        const key = `redis-test-${Date.now()}`;

        await cache.set(key, 'hello-redis');
        const val = await cache.get(key);
        expect(val).toBe('hello-redis');

        await cache.delete(key);
        const gone = await cache.get(key);
        expect(gone == null).toBe(true);
    }, 15000);

    it('exists() checks key presence', async () => {
        const cache = Cache.Redis(parseRedisUrl());
        const key = `redis-exists-${Date.now()}`;

        await cache.set(key, 'present');
        expect(await cache.exists(key)).toBeTruthy();

        await cache.delete(key);
    }, 15000);

    it('TTL support — key expires', async () => {
        const cache = Cache.Redis(parseRedisUrl());
        const key = `redis-ttl-${Date.now()}`;

        await cache.set(key, 'temporary', 2); // 2 second TTL
        expect(await cache.exists(key)).toBeTruthy();

        // Wait for expiration
        await new Promise((r) => setTimeout(r, 3000));
        const val = await cache.get(key);
        expect(val == null).toBe(true);
    }, 15000);
});
