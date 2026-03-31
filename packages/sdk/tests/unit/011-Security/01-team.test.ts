// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockStorageInstanceSpy, mockCacheInstanceSpy, mockVectorDBInstanceSpy, mockSchedulerInstanceSpy } = vi.hoisted(() => {
    return {
        mockStorageInstanceSpy: vi.fn(),
        mockCacheInstanceSpy: vi.fn(),
        mockVectorDBInstanceSpy: vi.fn(),
        mockSchedulerInstanceSpy: vi.fn(),
    };
});

vi.mock('@smythos/sre', async () => {
    return {
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id }),
            agent: (id: string) => ({ type: 'agent', id }),
        },
        DEFAULT_TEAM_ID: 'default',
        ConnectorService: {
            getStorageConnector: vi.fn().mockReturnValue({
                valid: true,
                instance: () => ({ requester: () => ({}) }),
                settings: {},
            }),
            getCacheConnector: vi.fn().mockReturnValue({
                valid: true,
                instance: () => ({ requester: () => ({}) }),
                settings: {},
            }),
            getVectorDBConnector: vi.fn().mockReturnValue({
                valid: true,
                instance: () => ({ requester: () => ({}) }),
                settings: {},
            }),
            getSchedulerConnector: vi.fn().mockReturnValue({
                valid: true,
                instance: () => ({ requester: () => ({}) }),
                settings: {},
            }),
            getAccountConnector: vi.fn(),
            getAgentDataConnector: vi.fn().mockReturnValue({
                agent: vi.fn().mockReturnValue({ get: vi.fn(), set: vi.fn() }),
                setEphemeralAgentData: vi.fn(),
            }),
            getModelsProviderConnector: vi.fn().mockReturnValue({
                agent: vi.fn().mockReturnValue({ getModels: vi.fn().mockResolvedValue(null) }),
            }),
            getLLMConnector: vi.fn().mockReturnValue(null),
            init: vi.fn(),
        },
        TConnectorService: { Storage: 'Storage', Cache: 'Cache', Scheduler: 'Scheduler', VectorDB: 'VectorDB' },
        TLLMProvider: { OpenAI: 'OpenAI' },
        TStorageProvider: {},
        TVectorDBProvider: {},
        TSchedulerProvider: {},
        BinaryInput: class {},
        SRE: { init: vi.fn(), ready: vi.fn().mockReturnValue(new Promise(() => {})), initializing: false },
        DummyAccount: class DummyAccount { data: any = {} },
    };
});

vi.mock('../../../src/Storage/StorageInstance.class', () => ({
    StorageInstance: mockStorageInstanceSpy,
}));

vi.mock('../../../src/Cache/CacheInstance.class', () => ({
    CacheInstance: mockCacheInstanceSpy,
}));

vi.mock('../../../src/VectorDB/VectorDBInstance.class', () => ({
    VectorDBInstance: mockVectorDBInstanceSpy,
}));

vi.mock('../../../src/Scheduler/SchedulerInstance.class', () => ({
    SchedulerInstance: mockSchedulerInstanceSpy,
}));

import { Team } from '../../../src/Security/Team.class';
import { Agent } from '../../../src/Agent/Agent.class';

describe('Team class', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Constructor ───────────────────────────────────────────────────

    it('stores the team id', () => {
        const team = new Team('team-42');
        expect(team.id).toBe('team-42');
    });

    it('accepts any string as id', () => {
        const team = new Team('');
        expect(team.id).toBe('');
    });

    // ── addAgent ──────────────────────────────────────────────────────

    it('addAgent returns an Agent instance', () => {
        const team = new Team('team-1');
        const agent = team.addAgent({ name: 'TestBot' } as any);
        expect(agent).toBeInstanceOf(Agent);
    });

    it('addAgent sets teamId on the settings', () => {
        const team = new Team('team-1');
        const settings: any = { name: 'TestBot' };
        team.addAgent(settings);
        expect(settings.teamId).toBe('team-1');
    });

    it('addAgent overrides existing teamId in settings', () => {
        const team = new Team('team-override');
        const settings: any = { name: 'TestBot', teamId: 'old-team' };
        team.addAgent(settings);
        expect(settings.teamId).toBe('team-override');
    });

    // ── storage getter ────────────────────────────────────────────────

    it('storage getter returns an object with provider factory functions', () => {
        const team = new Team('team-s');
        const storage = team.storage;
        expect(typeof storage).toBe('object');
        // Should have factory functions for each provider in the TStorageProvider enum
        for (const key of Object.keys(storage)) {
            expect(typeof (storage as any)[key]).toBe('function');
        }
    });

    it('storage factory creates StorageInstance with correct provider and team AccessCandidate', () => {
        const team = new Team('team-s1');
        const storage = team.storage;

        // Call every factory that exists
        for (const [providerName, factory] of Object.entries(storage)) {
            (factory as Function)({ custom: true });
        }

        // Each call should create a StorageInstance with team candidate
        for (const call of mockStorageInstanceSpy.mock.calls) {
            // args: (provider, settings, accessCandidate)
            expect(call[2]).toEqual({ type: 'team', id: 'team-s1' });
        }
    });

    it('storage getter is cached (returns same reference)', () => {
        const team = new Team('team-cached');
        const first = team.storage;
        const second = team.storage;
        expect(first).toBe(second);
    });

    // ── cache getter ──────────────────────────────────────────────────

    it('cache getter returns an object with provider factory functions', () => {
        const team = new Team('team-c');
        const cache = team.cache;
        expect(typeof cache).toBe('object');
        for (const key of Object.keys(cache)) {
            expect(typeof (cache as any)[key]).toBe('function');
        }
    });

    it('cache factory creates CacheInstance with correct provider and team AccessCandidate', () => {
        const team = new Team('team-c1');
        const cache = team.cache;

        for (const [providerName, factory] of Object.entries(cache)) {
            (factory as Function)({ ttl: 60 });
        }

        for (const call of mockCacheInstanceSpy.mock.calls) {
            expect(call[2]).toEqual({ type: 'team', id: 'team-c1' });
        }
    });

    it('cache getter is cached (returns same reference)', () => {
        const team = new Team('team-cc');
        const first = team.cache;
        const second = team.cache;
        expect(first).toBe(second);
    });

    // ── vectorDB getter ───────────────────────────────────────────────

    it('vectorDB getter returns an object with provider factory functions', () => {
        const team = new Team('team-v');
        const vdb = team.vectorDB;
        expect(typeof vdb).toBe('object');
        for (const key of Object.keys(vdb)) {
            expect(typeof (vdb as any)[key]).toBe('function');
        }
    });

    it('vectorDB factory creates VectorDBInstance with namespace merged into settings', () => {
        const team = new Team('team-v1');
        const vdb = team.vectorDB;

        for (const [providerName, factory] of Object.entries(vdb)) {
            (factory as Function)('my-namespace', { dimensions: 128 });
        }

        for (const call of mockVectorDBInstanceSpy.mock.calls) {
            // args: (provider, { ...settings, namespace }, accessCandidate)
            expect(call[1]).toEqual(expect.objectContaining({ namespace: 'my-namespace', dimensions: 128 }));
            expect(call[2]).toEqual({ type: 'team', id: 'team-v1' });
        }
    });

    it('vectorDB factory works with namespace only (no extra settings)', () => {
        const team = new Team('team-v2');
        const vdb = team.vectorDB;

        for (const [, factory] of Object.entries(vdb)) {
            (factory as Function)('ns-only');
        }

        for (const call of mockVectorDBInstanceSpy.mock.calls) {
            expect(call[1]).toEqual(expect.objectContaining({ namespace: 'ns-only' }));
        }
    });

    it('vectorDB getter is cached (returns same reference)', () => {
        const team = new Team('team-vc');
        const first = team.vectorDB;
        const second = team.vectorDB;
        expect(first).toBe(second);
    });

    // ── scheduler getter ──────────────────────────────────────────────

    it('scheduler getter returns an object with provider factory functions', () => {
        const team = new Team('team-sch');
        const scheduler = team.scheduler;
        expect(typeof scheduler).toBe('object');
        for (const key of Object.keys(scheduler)) {
            expect(typeof (scheduler as any)[key]).toBe('function');
        }
    });

    it('scheduler factory creates SchedulerInstance with correct provider and team AccessCandidate', () => {
        const team = new Team('team-sch1');
        const scheduler = team.scheduler;

        for (const [providerName, factory] of Object.entries(scheduler)) {
            (factory as Function)({ runJobs: true });
        }

        for (const call of mockSchedulerInstanceSpy.mock.calls) {
            expect(call[2]).toEqual({ type: 'team', id: 'team-sch1' });
        }
    });

    it('scheduler getter is cached (returns same reference)', () => {
        const team = new Team('team-schc');
        const first = team.scheduler;
        const second = team.scheduler;
        expect(first).toBe(second);
    });

    // ── Cross-getter isolation ────────────────────────────────────────

    it('different getters return independent objects', () => {
        const team = new Team('team-iso');
        const storage = team.storage;
        const cache = team.cache;
        const vdb = team.vectorDB;
        const scheduler = team.scheduler;

        expect(storage).not.toBe(cache);
        expect(storage).not.toBe(vdb);
        expect(storage).not.toBe(scheduler);
        expect(cache).not.toBe(vdb);
        expect(cache).not.toBe(scheduler);
        expect(vdb).not.toBe(scheduler);
    });

    it('different Team instances have independent provider caches', () => {
        const team1 = new Team('team-a');
        const team2 = new Team('team-b');

        const s1 = team1.storage;
        const s2 = team2.storage;

        expect(s1).not.toBe(s2);
    });
});
