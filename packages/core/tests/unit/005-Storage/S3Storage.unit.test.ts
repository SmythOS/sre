import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { StorageConnector } from '@sre/IO/Storage.service/StorageConnector';
import { S3Storage } from '@sre/IO/Storage.service/connectors/S3Storage.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { Readable } from 'stream';

// Mock S3 lifecycle helpers
vi.mock('@sre/helpers/S3Cache.helper', () => {
    return {
        checkAndInstallLifecycleRules: vi.fn(async () => {}),
        ttlToExpiryDays: (ttlSeconds: number) => ttlSeconds / (24 * 3600),
        generateExpiryMetadata: (days: number) => ({ Key: 'expiry-date', Value: new Date(Date.now() + days * 24 * 3600 * 1000).toUTCString() }),
    };
});

// Mock AWS S3 SDK
vi.mock('@aws-sdk/client-s3', () => {
    type Obj = {
        Body?: Buffer;
        Metadata?: Record<string, string>;
        ContentType?: string;
        Tags?: Record<string, string>;
    };
    const bucketStore = new Map<string, Record<string, Obj>>();

    class S3Client {
        config: any;
        constructor(config: any) {
            this.config = config;
        }
        async send(command: any): Promise<any> {
            const { input } = command as any;
            const Bucket = input.Bucket;
            if (!bucketStore.has(Bucket)) bucketStore.set(Bucket, {});
            const store = bucketStore.get(Bucket)!;
            if (command instanceof HeadObjectCommand) {
                const obj = store[input.Key];
                if (!obj) {
                    const err: any = new Error('NotFound');
                    err.name = 'NotFound';
                    throw err;
                }
                const Expiration = obj.Tags?.['expiry-date'] ? `expiry-date="${obj.Tags['expiry-date']}"` : undefined;
                return { Metadata: obj.Metadata || {}, ContentType: obj.ContentType || 'application/octet-stream', Expiration };
            } else if (command instanceof GetObjectCommand) {
                const obj = store[input.Key];
                if (!obj) {
                    const err: any = new Error('NoSuchKey');
                    err.name = 'NoSuchKey';
                    throw err;
                }
                return { Body: Readable.from(obj.Body ?? Buffer.alloc(0)) };
            } else if (command instanceof PutObjectCommand) {
                store[input.Key] = {
                    Body: Buffer.isBuffer(input.Body) ? input.Body : Buffer.from(input.Body),
                    Metadata: input.Metadata || {},
                    ContentType: input.ContentType,
                    Tags: store[input.Key]?.Tags || {},
                };
                return {};
            } else if (command instanceof DeleteObjectCommand) {
                delete store[input.Key];
                return {};
            } else if (command instanceof PutObjectTaggingCommand) {
                const obj = store[input.Key] || (store[input.Key] = {});
                obj.Tags = obj.Tags || {};
                for (const tag of input.Tagging?.TagSet || []) obj.Tags[tag.Key] = tag.Value;
                return {};
            }
            return {};
        }
    }

    class HeadObjectCommand {
        input: any;
        constructor(input: any) {
            this.input = input;
        }
    }
    class GetObjectCommand {
        input: any;
        constructor(input: any) {
            this.input = input;
        }
    }
    class PutObjectCommand {
        input: any;
        constructor(input: any) {
            this.input = input;
        }
    }
    class DeleteObjectCommand {
        input: any;
        constructor(input: any) {
            this.input = input;
        }
    }
    class PutObjectTaggingCommand {
        input: any;
        constructor(input: any) {
            this.input = input;
        }
    }

    return { S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, PutObjectTaggingCommand };
});

beforeAll(() => {
    setupSRE({
        Storage: {
            Connector: 'S3',
            Settings: {
                bucket: 'test-bucket',
                region: 'us-east-1',
                accessKeyId: 'AKIA',
                secretAccessKey: 'SECRET',
            },
        },
        Log: { Connector: 'ConsoleLog' },
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('S3Storage connector - unit (mocked S3)', () => {
    it('initializes and exposes instance', async () => {
        const storage: StorageConnector = ConnectorService.getStorageConnector();
        expect(storage).toBeInstanceOf(S3Storage);
    });

    it('write/read/exists/getMetadata/getACL roundtrip with ACL ownership', async () => {
        const storage = ConnectorService.getStorageConnector();
        const user = AccessCandidate.user('u1');
        const key = 'folder/file.txt';

        const acl = new ACL().addAccess(TAccessRole.Team, 'team-x', TAccessLevel.Read).ACL;
        const metadata = { ContentType: 'text/plain', custom: { a: 1 } } as any;
        await storage.requester(user).write(key, Buffer.from('hello s3'), acl, metadata);

        await expect(storage.requester(user).exists(key)).resolves.toBe(true);
        const buf = await storage.requester(user).read(key);
        expect(buf?.toString()).toBe('hello s3');

        const md = await storage.requester(user).getMetadata(key);
        expect(md?.ContentType).toBe('text/plain');
        expect(md?.custom?.a).toBe(1);

        const objAcl = await storage.requester(user).getACL(key);
        expect(objAcl.checkExactAccess(user.ownerRequest)).toBe(true);
    });

    it('setMetadata merges and setACL preserves requester ownership', async () => {
        const storage = ConnectorService.getStorageConnector();
        const user = AccessCandidate.user('u2');
        const key = 'merge/one.txt';
        await storage.requester(user).write(key, Buffer.from('x'), undefined, { a: 1 });

        await storage.requester(user).setMetadata(key, { b: 2 });
        const md = await storage.requester(user).getMetadata(key);
        expect(md?.a).toBe(1);
        expect(md?.b).toBe(2);

        const otherAcl = new ACL().addAccess(TAccessRole.User, 'other', TAccessLevel.Owner).ACL;
        await storage.requester(user).setACL(key, otherAcl);
        const acl = await storage.requester(user).getACL(key);
        expect(acl.checkExactAccess(user.ownerRequest)).toBe(true);
    });

    it('delete removes object and exists returns false (read rejects after delete)', async () => {
        const storage = ConnectorService.getStorageConnector();
        const user = AccessCandidate.user('u3');
        const key = 'to/delete.txt';
        await storage.requester(user).write(key, Buffer.from('z'));
        await storage.requester(user).delete(key);
        await expect(storage.requester(user).exists(key)).resolves.toBe(false);
        // S3Storage.read performs a HeadObject first (unguarded), which throws on missing objects
        await expect(storage.requester(user).read(key)).rejects.toHaveProperty('name');
    });

    it('expire sets tag; reading expired object deletes and returns undefined', async () => {
        const storage = ConnectorService.getStorageConnector();
        const user = AccessCandidate.user('u4');
        const key = 'expiring/file.txt';
        await storage.requester(user).write(key, Buffer.from('will-expire'), undefined, { ContentType: 'text/plain' });
        // set expiration to past by passing negative ttl
        await storage.requester(user).expire(key, -24 * 3600);
        const data = await storage.requester(user).read(key);
        expect(data).toBeUndefined();
        await expect(storage.requester(user).exists(key)).resolves.toBe(false);
    });
});
