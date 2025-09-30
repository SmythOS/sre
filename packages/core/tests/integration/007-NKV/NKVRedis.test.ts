import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { NKVRedis } from '@sre/IO/NKV.service/connectors/NKVRedis.class';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost:6379';
const SKIP_REDIS_TESTS = process.env.SKIP_REDIS_TESTS === 'true';

beforeAll(() => {
    if (SKIP_REDIS_TESTS) return;
    setupSRE({
        Cache: { Connector: 'Redis', Settings: { hosts: REDIS_HOST, name: process.env.REDIS_MASTER_NAME } },
        NKV: { Connector: 'Redis' },
        Log: { Connector: 'ConsoleLog' },
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('NKVRedis - integration (actual connector)', () => {
    it.skipIf(SKIP_REDIS_TESTS)('set/get/exists/delete/list/deleteAll within namespace', async () => {
        const nkv = ConnectorService.getNKVConnector('Redis');
        expect(nkv).toBeInstanceOf(NKVRedis);

        const user = AccessCandidate.user('nkv-redis-user');
        const client = nkv.requester(user);

        const ns = 'redis:alpha';
        await client.set(ns, 'k1', '1');
        await client.set(ns, 'k2', '2');

        await expect(client.exists(ns, 'k1')).resolves.toBe(true);
        const v1 = await client.get(ns, 'k1');
        expect(v1).toBe('1');

        const list = await client.list(ns);
        expect(list.map((e) => e.key).sort()).toEqual(['k1', 'k2']);

        await client.delete(ns, 'k1');
        await expect(client.exists(ns, 'k1')).resolves.toBe(false);

        await client.deleteAll(ns);
        const listAfter = await client.list(ns);
        expect(listAfter.length).toBe(0);
    });
});
