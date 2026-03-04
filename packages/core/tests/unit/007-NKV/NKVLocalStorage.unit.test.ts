import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { NKVLocalStorage } from '@sre/IO/NKV.service/connectors/NKVLocalStorage.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

let tempRoot: string;

beforeAll(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sre-nkv-ls-unit-'));
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

describe('NKVLocalStorage - unit (temp fs)', () => {
    it('set/get/exists/delete/list/deleteAll', async () => {
        const nkv = ConnectorService.getNKVConnector('LocalStorage');
        expect(nkv).toBeInstanceOf(NKVLocalStorage);
        const user = AccessCandidate.user('unit-local');
        const client = nkv.requester(user);
        const ns = 'unit:ns';

        await client.set(ns, 'k1', JSON.stringify({ a: 1 }));
        await client.set(ns, 'k2', JSON.stringify({ b: 2 }));
        await expect(client.exists(ns, 'k1')).resolves.toBe(true);
        const v1 = await client.get(ns, 'k1');
        expect(String(v1)).toBe(JSON.stringify({ a: 1 }));
        const list = await client.list(ns);
        expect(list.map((e) => e.key).sort()).toEqual(['k1', 'k2']);
        await client.delete(ns, 'k1');
        await expect(client.exists(ns, 'k1')).resolves.toBe(false);
        await client.deleteAll(ns);
        const after = await client.list(ns);
        expect(after.length).toBe(0);
    });
});
