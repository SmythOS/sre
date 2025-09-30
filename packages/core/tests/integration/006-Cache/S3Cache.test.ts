import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { S3Cache } from '@sre/MemoryManager/Cache.service/connectors/S3Cache.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';

// Note: This test requires AWS S3 credentials and bucket
// You can skip this test if S3 is not available by setting SKIP_S3_TESTS=true

const S3_BUCKET = process.env.S3_CACHE_BUCKET_NAME;
const S3_REGION = process.env.AWS_REGION || 'us-east-1';
const S3_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const S3_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const SKIP_S3_TESTS = process.env.SKIP_S3_TESTS === 'true' || !S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET_KEY;

beforeAll(() => {
    if (SKIP_S3_TESTS) {
        console.log('Skipping S3 Cache tests - missing credentials or SKIP_S3_TESTS=true');
        return;
    }

    setupSRE({
        Cache: {
            Connector: 'S3',
            Settings: {
                bucketName: S3_BUCKET,
                region: S3_REGION,
                accessKeyId: S3_ACCESS_KEY,
                secretAccessKey: S3_SECRET_KEY,
            },
        },
        Log: { Connector: 'ConsoleLog' },
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('S3Cache - integration (actual connector)', () => {
    it.skipIf(SKIP_S3_TESTS)('should set/get/exists/delete roundtrip with ACL ownership', async () => {
        const cache = ConnectorService.getCacheConnector('S3');
        expect(cache).toBeInstanceOf(S3Cache);

        const user = AccessCandidate.user('s3-cache-user');
        const client = cache.requester(user);

        const key = 'k:s3:alpha';
        const acl = new ACL().addAccess(TAccessRole.Team, 'team-x', TAccessLevel.Read).ACL;
        const metadata = { tag: 's3-v1' } as any;

        await client.set(key, 's3-value-1', acl, metadata);
        await expect(client.exists(key)).resolves.toBe(true);
        await expect(client.get(key)).resolves.toBe('s3-value-1');

        const md = await client.getMetadata(key);
        expect(md?.tag).toBe('s3-v1');
        const objAcl = await client.getACL(key);
        expect(ACL.from(objAcl as any).checkExactAccess(user.ownerRequest)).toBe(true);

        await client.delete(key);
        await expect(client.exists(key)).resolves.toBe(false);
    });

    it.skipIf(SKIP_S3_TESTS)('should support TTL expiry with S3 lifecycle', async () => {
        const cache = ConnectorService.getCacheConnector('S3');
        const user = AccessCandidate.user('s3-ttl-user');
        const client = cache.requester(user);

        const key = 'k:s3:ttl';
        await client.set(key, 's3-temp', undefined, {}, 86400); // 1 day TTL

        // TTL in S3 is managed by lifecycle rules, not immediate expiry
        // We test that the object exists and has proper tagging
        await expect(client.exists(key)).resolves.toBe(true);

        // Update TTL
        await client.updateTTL(key, 172800); // 2 days

        // Note: S3 getTTL returns days, not seconds like other cache implementations
        const ttl = await client.getTTL(key);
        expect(ttl).toBeGreaterThanOrEqual(1); // At least 1 day remaining
    });

    it.skipIf(SKIP_S3_TESTS)('setMetadata and setACL should update metadata and preserve ownership', async () => {
        const cache = ConnectorService.getCacheConnector('S3');
        const user = AccessCandidate.user('s3-meta-user');
        const client = cache.requester(user);

        const key = 'k:s3:meta';
        await client.set(key, 's3-v');

        await client.setMetadata(key, { s3Field: 'test' });
        const md1 = await client.getMetadata(key);
        expect(md1?.s3Field).toBe('test');

        const newAcl = new ACL().addAccess(TAccessRole.User, 'other', TAccessLevel.Owner).ACL;
        await client.setACL(key, newAcl);
        const got = await client.getACL(key);
        expect(ACL.from(got as any).checkExactAccess(user.ownerRequest)).toBe(true);

        // Cleanup
        await client.delete(key);
    });

    it.skipIf(SKIP_S3_TESTS)('should handle S3 client and bucket configuration', async () => {
        const cache = ConnectorService.getCacheConnector('S3') as S3Cache;
        expect(cache.client).toBeDefined();
        expect(cache.name).toBe('S3Cache');
    });
});
