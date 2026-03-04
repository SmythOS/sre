import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { S3Cache } from '@sre/MemoryManager/Cache.service/connectors/S3Cache.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { Readable } from 'stream';

vi.mock('@sre/helpers/S3Cache.helper', () => {
    return {
        checkAndInstallLifecycleRules: vi.fn(async () => {}),
        ttlToExpiryDays: (ttlSeconds: number) => ttlSeconds / (24 * 3600),
        generateExpiryMetadata: (days: number) => ({ Key: 'expiry-date', Value: new Date(Date.now() + days * 24 * 3600 * 1000).toUTCString() }),
    };
});

vi.mock('@aws-sdk/client-s3', () => {
    type Obj = { Body?: string; Metadata?: Record<string, string>; Tagging?: string };
    const bucketStore = new Map<string, Record<string, Obj>>();

    class S3Client {
        constructor(_: any) {}
        async send(command: any) {
            const { input } = command;
            if (command instanceof HeadObjectCommand) {
                const obj = bucketStore.get(input.Bucket)?.[input.Key];
                if (!obj) {
                    const err: any = new Error('NotFound');
                    err.name = 'NotFound';
                    throw err;
                }
                const Expiration = obj.Tagging?.includes('expiry-date') ? `expiry-date="${obj.Tagging.split('=')[1]}"` : undefined;
                return { Metadata: obj.Metadata || {}, ContentType: 'text/plain', Expiration };
            } else if (command instanceof GetObjectCommand) {
                const obj = bucketStore.get(input.Bucket)?.[input.Key];
                if (!obj) {
                    const err: any = new Error('NoSuchKey');
                    err.name = 'NoSuchKey';
                    throw err;
                }
                return { Body: { transformToString: async () => obj.Body ?? '' } };
            } else if (command instanceof PutObjectCommand) {
                const bucket = bucketStore.get(input.Bucket) || (bucketStore.set(input.Bucket, {}), bucketStore.get(input.Bucket)!);
                bucket[input.Key] = {
                    Body: typeof input.Body === 'string' ? input.Body : String(input.Body),
                    Metadata: input.Metadata || {},
                    Tagging: input.Tagging,
                };
                return {};
            } else if (command instanceof DeleteObjectCommand) {
                const bucket = bucketStore.get(input.Bucket) || {};
                delete bucket[input.Key];
                return {};
            } else if (command instanceof PutObjectTaggingCommand) {
                const bucket = bucketStore.get(input.Bucket) || (bucketStore.set(input.Bucket, {}), bucketStore.get(input.Bucket)!);
                const obj = bucket[input.Key] || (bucket[input.Key] = {});
                obj.Tagging = (input.Tagging?.TagSet || []).map((t: any) => `${t.Key}=${t.Value}`).join('&');
                return {};
            } else if (command instanceof GetObjectTaggingCommand) {
                return { TagSet: [] };
            } else if (command instanceof CopyObjectCommand) {
                const bucket = bucketStore.get(input.Bucket) || (bucketStore.set(input.Bucket, {}), bucketStore.get(input.Bucket)!);
                const dest = bucket[input.Key] || (bucket[input.Key] = {});
                dest.Metadata = input.Metadata || {};
                dest.Tagging = input.Tagging;
                return {};
            }
        }
    }

    class HeadObjectCommand {
        constructor(public input: any) {}
    }
    class GetObjectCommand {
        constructor(public input: any) {}
    }
    class PutObjectCommand {
        constructor(public input: any) {}
    }
    class DeleteObjectCommand {
        constructor(public input: any) {}
    }
    class PutObjectTaggingCommand {
        constructor(public input: any) {}
    }
    class GetObjectTaggingCommand {
        constructor(public input: any) {}
    }
    class CopyObjectCommand {
        constructor(public input: any) {}
    }

    return {
        S3Client,
        HeadObjectCommand,
        GetObjectCommand,
        PutObjectCommand,
        DeleteObjectCommand,
        PutObjectTaggingCommand,
        GetObjectTaggingCommand,
        CopyObjectCommand,
    };
});

beforeAll(() => {
    setupSRE({
        Cache: { Connector: 'S3', Settings: { bucketName: 'test-bucket', region: 'us-east-1', accessKeyId: 'AK', secretAccessKey: 'SK' } },
        Log: { Connector: 'ConsoleLog' },
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('S3Cache - unit (mocked S3)', () => {
    it('set/get/exists/delete with ACL ownership', async () => {
        const cache = ConnectorService.getCacheConnector('S3');
        expect(cache).toBeInstanceOf(S3Cache);
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
    });

    it('TTL/updateTTL/getTTL mocked semantics', async () => {
        const cache = ConnectorService.getCacheConnector('S3');
        const user = AccessCandidate.user('u2');
        const client = cache.requester(user);
        const key = 'unit:ttl';
        await client.set(key, 'temp', undefined, {}, 86400);
        await client.updateTTL(key, 172800);
        const ttl = await client.getTTL(key);
        expect(ttl).toBeGreaterThanOrEqual(0);
    });
});
