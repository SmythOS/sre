import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { StorageConnector } from '@sre/IO/Storage.service/StorageConnector';
import { LocalStorage } from '@sre/IO/Storage.service/connectors/LocalStorage.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';

let tempRoot: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sre-localstorage-'));
    setupSRE({
        Storage: {
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

describe('LocalStorage connector - unit (in temp dir)', () => {
    it('should initialize storage and metadata folders under provided folder', async () => {
        const storage: StorageConnector = ConnectorService.getStorageConnector();
        expect(storage).toBeInstanceOf(LocalStorage);

        // Trigger initialization by a simple exists call
        const user = AccessCandidate.user('init-user');
        await storage.requester(user).exists('nonexistent.txt');

        expect(fs.existsSync(path.join(tempRoot, 'local'))).toBe(true);
        expect(fs.existsSync(path.join(tempRoot, '.local.metadata'))).toBe(true);
        expect(fs.existsSync(path.join(tempRoot, '.local.metadata', 'README_IMPORTANT.txt'))).toBe(true);
    });

    it('read should return undefined for missing files', async () => {
        const storage = ConnectorService.getStorageConnector();
        const user = AccessCandidate.user('reader');
        const data = await storage.requester(user).read('missing.txt');
        expect(data).toBeUndefined();
    });

    it('write should persist file and metadata (including ACL); exists/getMetadata/getACL should reflect state', async () => {
        const storage = ConnectorService.getStorageConnector();
        const user = AccessCandidate.user('writer');
        const resource = 'dir/sample.txt';

        const initialAcl = new ACL().addAccess(TAccessRole.User, 'someone-else', TAccessLevel.Read).ACL;
        const initialMeta = { 'Content-Type': 'text/plain', any: { nested: true } } as any;

        await storage.requester(user).write(resource, Buffer.from('hello world'), initialAcl, initialMeta);

        // exists
        await expect(storage.requester(user).exists(resource)).resolves.toBe(true);

        // read
        const readBack = await storage.requester(user).read(resource);
        expect(readBack?.toString()).toBe('hello world');

        // metadata should include ACL (deserialized) and our fields
        const meta = await storage.requester(user).getMetadata(resource);
        expect(meta?.['Content-Type']).toBe('text/plain');
        expect(meta?.any?.nested).toBe(true);
        expect(ACL.from(meta?.acl).checkExactAccess(user.ownerRequest)).toBe(true);

        // getACL should return proper ACL with ownership retained
        const aclObj = await storage.requester(user).getACL(resource);
        expect(aclObj.checkExactAccess(user.ownerRequest)).toBe(true);
    });

    it('setMetadata should merge new keys without dropping existing', async () => {
        const storage = ConnectorService.getStorageConnector();
        const user = AccessCandidate.user('meta-user');
        const resource = 'merge/meta.txt';
        await storage.requester(user).write(resource, Buffer.from('x'), undefined, { a: 1 });

        await storage.requester(user).setMetadata(resource, { b: 2 });
        const meta = await storage.requester(user).getMetadata(resource);
        expect(meta?.a).toBe(1);
        expect(meta?.b).toBe(2);
    });

    it('setACL should preserve requester ownership in ACL', async () => {
        const storage = ConnectorService.getStorageConnector();
        const user = AccessCandidate.user('acl-user');
        const resource = 'acl/file.txt';
        await storage.requester(user).write(resource, Buffer.from('y'));

        // Provide ACL without requester
        const otherAcl = new ACL().addAccess(TAccessRole.User, 'other', TAccessLevel.Owner).ACL;
        await storage.requester(user).setACL(resource, otherAcl);

        const aclObj = await storage.requester(user).getACL(resource);
        // must include requester as Owner as well
        expect(aclObj.checkExactAccess(user.ownerRequest)).toBe(true);
    });

    it('delete should remove file and metadata', async () => {
        const storage = ConnectorService.getStorageConnector();
        const user = AccessCandidate.user('deleter');
        const resource = 'to/delete.txt';
        await storage.requester(user).write(resource, Buffer.from('z'), undefined, { x: 1 });

        await storage.requester(user).delete(resource);
        await expect(storage.requester(user).exists(resource)).resolves.toBe(false);
        const metaFile = path.join(tempRoot, '.local.metadata', resource);
        expect(fs.existsSync(metaFile)).toBe(false);
    });
});
