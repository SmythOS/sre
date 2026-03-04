import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { NKVRedis } from '@sre/IO/NKV.service/connectors/NKVRedis.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

// Mock ioredis to avoid external dependency used indirectly by RedisCache
vi.mock('ioredis', () => {
    const store = new Map<string, string>();
    return {
        default: class IORedisMock {
            async get(key: string) {
                return store.get(key) ?? null;
            }
            async set(key: string, val: string) {
                store.set(key, val);
            }
            async del(keys: string | string[]) {
                Array.isArray(keys) ? keys.forEach((k) => store.delete(k)) : store.delete(keys);
            }
            async exists(key: string) {
                return store.has(key) ? 1 : 0;
            }
            async scan(cursor: string, _match: string, pattern: string, _count: string, count: number) {
                const prefix = pattern.replace('*', '');
                const keys = [...store.keys()].filter((k) => k.startsWith(prefix));
                return ['0', keys];
            }
            pipeline() {
                const cmds: any[] = [];
                const obj: any = {};
                obj.get = (k: string) => {
                    cmds.push(['get', k]);
                    return obj;
                };
                obj.exec = async () => {
                    const results: any[] = [];
                    for (const [_c, k] of cmds) {
                        results.push([null, store.get(k)]);
                    }
                    return results;
                };
                return obj;
            }
            on() {}
            async quit() {}
        },
    };
});

beforeAll(() => {
    setupSRE({
        Cache: { Connector: 'Redis', Settings: { hosts: 'localhost:6379', name: 'mymaster' } },
        NKV: { Connector: 'Redis' },
        Log: { Connector: 'ConsoleLog' },
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('NKVRedis - unit (mocked Redis)', () => {
    it('set/get/exists/delete/list/deleteAll', async () => {
        const nkv = ConnectorService.getNKVConnector('Redis');
        expect(nkv).toBeInstanceOf(NKVRedis);

        const user = AccessCandidate.user('unit-redis');
        const client = nkv.requester(user);
        const ns = 'unit:ns';

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
        const after = await client.list(ns);
        expect(after.length).toBe(0);
    });
});
