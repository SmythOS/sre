import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { NKVLocalStorage } from '@sre/IO/NKV.service/connectors/NKVLocalStorage.class';

let tempRoot: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sre-nkv-local-'));
    setupSRE({
        NKV: { Connector: 'LocalStorage', Settings: { folder: tempRoot } },
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

describe('NKVLocalStorage - integration (actual connector)', () => {
    it('set/get/exists/delete/list/deleteAll within namespace', async () => {
        const nkv = ConnectorService.getNKVConnector('LocalStorage');
        expect(nkv).toBeInstanceOf(NKVLocalStorage);

        const user = AccessCandidate.user('nkv-local-user');
        const client = nkv.requester(user);

        const ns = 'local:alpha';
        await client.set(ns, 'k1', { a: 1 });
        await client.set(ns, 'k2', { b: 2 });

        await expect(client.exists(ns, 'k1')).resolves.toBe(true);
        const v1 = await client.get(ns, 'k1');
        expect(v1).toEqual({ a: 1 });

        const list = await client.list(ns);
        expect(list.map((e) => e.key).sort()).toEqual(['k1', 'k2']);

        await client.delete(ns, 'k1');
        await expect(client.exists(ns, 'k1')).resolves.toBe(false);

        await client.deleteAll(ns);
        const listAfter = await client.list(ns);
        expect(listAfter.length).toBe(0);
    });
});
