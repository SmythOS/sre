// prettier-ignore-file
import { SRE } from '@smythos/sre';
import { describe, it, beforeAll, expect } from 'vitest';
import { Storage } from '../../../src/index';

function uniqueName(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe('Storage - Standalone usage (default and LocalStorage)', () => {
    beforeAll(async () => {
        SRE.init({});
        await SRE.ready();
    });

    it('writes and reads text with default provider', async () => {
        const storage = Storage.default();
        const filename = uniqueName('standalone-default.txt');
        const content = 'Hello, default storage!';

        const uri = await storage.write(filename, content);
        expect(uri).toMatch(/^smythfs:\/\//);

        const data = await storage.read(filename);
        expect(Buffer.isBuffer(data)).toBe(true);
        expect(data?.toString()).toBe(content);
    });

    it('writes and reads Buffer with LocalStorage', async () => {
        const storage = Storage.LocalStorage();
        const filename = uniqueName('standalone-local.bin');
        const buffer = Buffer.from([0, 1, 2, 3, 4, 5]);

        const uri = await storage.write(filename, buffer);
        expect(uri).toMatch(/^smythfs:\/\//);

        const data = await storage.read(filename);
        expect(Buffer.isBuffer(data)).toBe(true);
        expect(data?.equals(buffer)).toBe(true);
    });

    it('overwrites existing resource and returns latest content', async () => {
        const storage = Storage.default();
        const filename = uniqueName('standalone-overwrite.txt');

        await storage.write(filename, 'v1');
        await storage.write(filename, 'v2');

        const data = await storage.read(filename);
        expect(data?.toString()).toBe('v2');
    });

    it('supports read by returned smythfs uri', async () => {
        const storage = Storage.LocalStorage();
        const filename = uniqueName('standalone-uri.txt');
        const content = 'Read me by URI';

        const uri = await storage.write(filename, content);
        const data = await storage.read(uri);
        expect(data?.toString()).toBe(content);
    });

    it('delete removes the resource; subsequent reads return null', async () => {
        const storage = Storage.default();
        const filename = uniqueName('standalone-delete.txt');
        await storage.write(filename, 'to be deleted');

        const uri = await storage.delete(filename);
        expect(uri).toMatch(/^smythfs:\/\//);

        const data = await storage.read(filename).catch(() => null);
        // SmythFS.read() returns null for non-existing resources (no throw)
        expect(data).toBeNull();
    });
});
