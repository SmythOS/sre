import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { NKVRAM } from '@sre/IO/NKV.service/connectors/NKVRAM.class';

beforeAll(() => {
    setupSRE({
        NKV: { Connector: 'RAM' },
        Log: { Connector: 'ConsoleLog' },
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('NKVRAM - integration (actual connector)', () => {
    it('set/get/exists/delete/list/deleteAll within namespace', async () => {
        const nkv = ConnectorService.getNKVConnector('RAM');
        expect(nkv).toBeInstanceOf(NKVRAM);

        const user = AccessCandidate.user('nkv-ram-user');
        const client = nkv.requester(user);

        const ns = 'ns:alpha';
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
        const listAfter = await client.list(ns);
        expect(listAfter.length).toBe(0);
    });
});
