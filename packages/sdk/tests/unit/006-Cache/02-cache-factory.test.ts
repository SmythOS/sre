// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCacheRequest, mockInstanceSpy, mockGetCacheConnectorSpy } = vi.hoisted(() => {
    const mockCacheRequest = {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        exists: vi.fn(),
        getTTL: vi.fn(),
        updateTTL: vi.fn(),
    };
    const mockInstanceSpy = vi.fn().mockReturnValue({
        requester: vi.fn().mockReturnValue(mockCacheRequest),
    });
    const mockGetCacheConnectorSpy = vi.fn().mockReturnValue({
        valid: true,
        instance: mockInstanceSpy,
        settings: {},
    });
    return { mockCacheRequest, mockInstanceSpy, mockGetCacheConnectorSpy };
});

vi.mock('@smythos/sre', async () => {
    return {
        DEFAULT_TEAM_ID: 'default',
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id }),
            agent: (id: string) => ({ type: 'agent', id }),
        },
        ConnectorService: {
            getCacheConnector: mockGetCacheConnectorSpy,
            init: vi.fn(),
            getModelsProviderConnector() { return null; },
            getLLMConnector() { return null; },
            getStorageConnector() { return null; },
            getVectorDBConnector() { return null; },
            getSchedulerConnector() { return null; },
        },
        TConnectorService: { Cache: 'Cache' },
        TLLMProvider: { OpenAI: 'OpenAI' },
        TStorageProvider: {},
        TVectorDBProvider: {},
        TSchedulerProvider: {},
        BinaryInput: class {},
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
    };
});

import { Cache } from '../../../src/Cache/Cache.class';
import { CacheInstance } from '../../../src/Cache/CacheInstance.class';

describe('Cache factory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockInstanceSpy.mockReturnValue({
            requester: vi.fn().mockReturnValue(mockCacheRequest),
        });
        mockGetCacheConnectorSpy.mockReturnValue({
            valid: true,
            instance: mockInstanceSpy,
            settings: {},
        });
    });

    // ── Provider methods exist ───────────────────────────────────────

    it('has factory methods for all built-in providers', () => {
        expect(typeof Cache.RAM).toBe('function');
        expect(typeof Cache.Redis).toBe('function');
        expect(typeof Cache.LocalStorage).toBe('function');
        expect(typeof Cache.S3).toBe('function');
    });

    // ── Basic creation ───────────────────────────────────────────────

    it('Cache.RAM() creates a CacheInstance', () => {
        const cache = Cache.RAM();
        expect(cache).toBeInstanceOf(CacheInstance);
    });

    it('Cache.RAM() calls getCacheConnector with "RAM" providerId', () => {
        Cache.RAM();
        expect(mockGetCacheConnectorSpy).toHaveBeenCalledWith('RAM');
    });

    // ── Settings passthrough ─────────────────────────────────────────

    it('passes connector settings to the instance', () => {
        const settings = { maxSize: 2048 };
        Cache.RAM(settings as any);

        expect(mockInstanceSpy).toHaveBeenCalledWith(expect.objectContaining({ maxSize: 2048 }));
    });

    it('strips scope from settings before passing to connector', () => {
        Cache.RAM({ scope: 'agent' as any, maxSize: 512 } as any);

        const passedSettings = mockInstanceSpy.mock.calls[0][0];
        expect(passedSettings).not.toHaveProperty('scope');
        expect(passedSettings).toHaveProperty('maxSize', 512);
    });

    // ── Scope / AccessCandidate ──────────────────────────────────────

    it('passes AccessCandidate scope to CacheInstance', () => {
        const candidate = { type: 'agent', id: 'agent-42' } as any;
        const cache = Cache.RAM({} as any, candidate);
        expect(cache).toBeInstanceOf(CacheInstance);
    });

    it('accepts scope inside settings object', () => {
        const candidate = { type: 'team', id: 'team-99' } as any;
        const cache = Cache.RAM({ scope: candidate } as any);
        expect(cache).toBeInstanceOf(CacheInstance);
    });

    it('prefers second argument scope over settings.scope', () => {
        const settingsCandidate = { type: 'team', id: 'from-settings' } as any;
        const argCandidate = { type: 'agent', id: 'from-arg' } as any;
        const cache = Cache.RAM({ scope: settingsCandidate } as any, argCandidate);
        expect(cache).toBeInstanceOf(CacheInstance);
    });

    // ── Scope string warning ─────────────────────────────────────────

    it('warns when Scope.AGENT string is used and falls back to default team', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const cache = Cache.RAM({} as any, 'agent' as any);

        expect(warnSpy).toHaveBeenCalledTimes(1);
        const msg = warnSpy.mock.calls[0][0] as string;
        expect(msg).toContain('agent scope');
        expect(msg).toContain('AccessCandidate.agent');
        expect(cache).toBeInstanceOf(CacheInstance);

        warnSpy.mockRestore();
    });

    it('warns when Scope.TEAM string is used and falls back to default team', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const cache = Cache.RAM({} as any, 'team' as any);

        expect(warnSpy).toHaveBeenCalledTimes(1);
        const msg = warnSpy.mock.calls[0][0] as string;
        expect(msg).toContain('team scope');
        expect(msg).toContain('AccessCandidate.team');
        expect(cache).toBeInstanceOf(CacheInstance);

        warnSpy.mockRestore();
    });

    // ── No settings / no scope ───────────────────────────────────────

    it('works with no arguments at all', () => {
        const cache = Cache.RAM();
        expect(cache).toBeInstanceOf(CacheInstance);
    });

    // ── Other providers ──────────────────────────────────────────────

    it('Cache.Redis() creates a CacheInstance with Redis provider', () => {
        const cache = Cache.Redis();
        expect(cache).toBeInstanceOf(CacheInstance);
        expect(mockGetCacheConnectorSpy).toHaveBeenCalledWith('Redis');
    });

    it('Cache.LocalStorage() creates a CacheInstance', () => {
        const cache = Cache.LocalStorage();
        expect(cache).toBeInstanceOf(CacheInstance);
        expect(mockGetCacheConnectorSpy).toHaveBeenCalledWith('LocalStorage');
    });

    it('Cache.S3() creates a CacheInstance', () => {
        const cache = Cache.S3();
        expect(cache).toBeInstanceOf(CacheInstance);
        expect(mockGetCacheConnectorSpy).toHaveBeenCalledWith('S3');
    });
});
