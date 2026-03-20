// prettier-ignore-file
/**
 * Cache.S3() integration — requires AWS credentials.
 *
 * Env vars:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_CACHE_BUCKET_NAME
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { Cache } from '../../../src/index';
import { initSRE, HAS_S3_CACHE } from '../_helpers';

describe.skipIf(!HAS_S3_CACHE)('Cache - S3 integration', () => {
    beforeAll(() => initSRE());

    const s3CacheConfig = () => ({
        bucketName: process.env.S3_CACHE_BUCKET_NAME!,
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    });

    it('set/get/delete cycle', async () => {
        const cache = Cache.S3(s3CacheConfig());
        const key = `s3-cache-test-${Date.now()}`;

        await cache.set(key, 'hello-s3');
        const val = await cache.get(key);
        expect(val.toString()).toBe('hello-s3');

        await cache.delete(key);
        const gone = await cache.get(key);
        expect(gone == null).toBe(true);
    }, 30000);

    it('exists() checks key presence', async () => {
        const cache = Cache.S3(s3CacheConfig());
        const key = `s3-exists-${Date.now()}`;

        await cache.set(key, 'present');
        expect(await cache.exists(key)).toBeTruthy();

        await cache.delete(key);
    }, 30000);

    it('TTL support — set with expiry', async () => {
        const cache = Cache.S3(s3CacheConfig());
        const key = `s3-ttl-${Date.now()}`;

        // S3 cache uses object tags/lifecycle for TTL
        await cache.set(key, 'expiring', 3600); // 1 hour TTL
        const val = await cache.get(key);
        expect(val.toString()).toBe('expiring');

        // Cleanup
        await cache.delete(key);
    }, 30000);
});
