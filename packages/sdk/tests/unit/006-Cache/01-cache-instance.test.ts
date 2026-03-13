// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCacheRequest = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    getTTL: vi.fn(),
    updateTTL: vi.fn(),
};

let mockConnectorValid = true;
let mockInitValid = true;

vi.mock('@smythos/sre', async () => {
    return {
        DEFAULT_TEAM_ID: 'default',
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id }),
            agent: (id: string) => ({ type: 'agent', id }),
        },
        ConnectorService: {
            getCacheConnector(providerId: string) {
                if (!mockConnectorValid) return null;
                return {
                    valid: true,
                    instance(settings: any) {
                        return {
                            requester(candidate: any) {
                                return mockCacheRequest;
                            },
                        };
                    },
                    settings: {},
                };
            },
            init(type: string, providerId: string, name: string, settings: any) {
                if (!mockInitValid) return null;
                return {
                    valid: true,
                    instance(settings: any) {
                        return {
                            requester(candidate: any) {
                                return mockCacheRequest;
                            },
                        };
                    },
                    settings: {},
                };
            },
            // Stubs required by other SDK modules that share the mock
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

import { CacheInstance } from '../../../src/Cache/CacheInstance.class';

describe('CacheInstance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockConnectorValid = true;
        mockInitValid = true;
    });

    // ── Constructor ──────────────────────────────────────────────────

    describe('constructor', () => {
        it('creates instance with default candidate when none provided', () => {
            const cache = new CacheInstance('RAM' as any);
            expect(cache).toBeInstanceOf(CacheInstance);
        });

        it('creates instance with custom candidate', () => {
            const candidate = { type: 'agent', id: 'agent-123' } as any;
            const cache = new CacheInstance('RAM' as any, {}, candidate);
            expect(cache).toBeInstanceOf(CacheInstance);
        });

        it('falls back to ConnectorService.init when getCacheConnector returns invalid', () => {
            mockConnectorValid = false;
            mockInitValid = true;
            const cache = new CacheInstance('RAM' as any);
            expect(cache).toBeInstanceOf(CacheInstance);
        });

        it('throws when connector is not available from both sources', () => {
            mockConnectorValid = false;
            mockInitValid = false;
            expect(() => new CacheInstance('BadProvider' as any)).toThrow(
                'Cache connector BadProvider is not available',
            );
        });

        it('passes cacheSettings to connector instance', async () => {
            const instanceSpy = vi.fn().mockReturnValue({
                requester: () => mockCacheRequest,
            });

            const { ConnectorService } = await import('@smythos/sre');
            const original = ConnectorService.getCacheConnector;
            ConnectorService.getCacheConnector = (() => ({
                valid: true,
                instance: instanceSpy,
                settings: { fallback: true },
            })) as any;

            const settings = { maxMemory: 1024 };
            new CacheInstance('RAM' as any, settings);
            expect(instanceSpy).toHaveBeenCalledWith(settings);

            ConnectorService.getCacheConnector = original;
        });

        it('uses empty object as default when cacheSettings is omitted', async () => {
            const instanceSpy = vi.fn().mockReturnValue({
                requester: () => mockCacheRequest,
            });

            const { ConnectorService } = await import('@smythos/sre');
            const original = ConnectorService.getCacheConnector;
            ConnectorService.getCacheConnector = (() => ({
                valid: true,
                instance: instanceSpy,
                settings: { defaultTTL: 300 },
            })) as any;

            new CacheInstance('RAM' as any);
            // Default param makes cacheSettings = {}, which is truthy
            expect(instanceSpy).toHaveBeenCalledWith({});

            ConnectorService.getCacheConnector = original;
        });
    });

    // ── SDKObject inheritance ────────────────────────────────────────

    describe('SDKObject inheritance', () => {
        it('has ready promise', () => {
            const cache = new CacheInstance('RAM' as any);
            expect(cache.ready).toBeDefined();
            expect(typeof cache.ready.then).toBe('function');
        });

        it('has event emitter methods', () => {
            const cache = new CacheInstance('RAM' as any);
            expect(typeof cache.on).toBe('function');
            expect(typeof cache.off).toBe('function');
            expect(typeof cache.once).toBe('function');
            expect(typeof cache.emit).toBe('function');
            expect(typeof cache.removeListener).toBe('function');
        });

        it('emits and receives events', () => {
            const cache = new CacheInstance('RAM' as any);
            const handler = vi.fn();
            cache.on('test-event', handler);
            cache.emit('test-event', 'payload');
            expect(handler).toHaveBeenCalledWith('payload');
        });
    });

    // ── get() ────────────────────────────────────────────────────────

    describe('get()', () => {
        it('delegates to _cacheRequest.get with the key', async () => {
            mockCacheRequest.get.mockResolvedValue('cached-value');
            const cache = new CacheInstance('RAM' as any);

            const result = await cache.get('my-key');

            expect(mockCacheRequest.get).toHaveBeenCalledWith('my-key');
            expect(result).toBe('cached-value');
        });

        it('returns undefined for missing keys', async () => {
            mockCacheRequest.get.mockResolvedValue(undefined);
            const cache = new CacheInstance('RAM' as any);

            const result = await cache.get('nonexistent');
            expect(result).toBeUndefined();
        });
    });

    // ── set() ────────────────────────────────────────────────────────

    describe('set()', () => {
        it('delegates with key, data, and undefined for acl/metadata', async () => {
            mockCacheRequest.set.mockResolvedValue(true);
            const cache = new CacheInstance('RAM' as any);

            const result = await cache.set('key1', { foo: 'bar' });

            expect(mockCacheRequest.set).toHaveBeenCalledWith(
                'key1',
                { foo: 'bar' },
                undefined,
                undefined,
                undefined,
            );
            expect(result).toBe(true);
        });

        it('passes TTL as the fifth argument', async () => {
            mockCacheRequest.set.mockResolvedValue(true);
            const cache = new CacheInstance('RAM' as any);

            await cache.set('key2', 'value', 3600);

            expect(mockCacheRequest.set).toHaveBeenCalledWith(
                'key2',
                'value',
                undefined,
                undefined,
                3600,
            );
        });

        it('handles various data types', async () => {
            mockCacheRequest.set.mockResolvedValue(true);
            const cache = new CacheInstance('RAM' as any);

            await cache.set('str', 'hello');
            await cache.set('num', 42);
            await cache.set('arr', [1, 2, 3]);
            await cache.set('obj', { nested: { deep: true } });

            expect(mockCacheRequest.set).toHaveBeenCalledTimes(4);
        });
    });

    // ── delete() ─────────────────────────────────────────────────────

    describe('delete()', () => {
        it('delegates to _cacheRequest.delete', async () => {
            mockCacheRequest.delete.mockResolvedValue(undefined);
            const cache = new CacheInstance('RAM' as any);

            await cache.delete('key-to-remove');

            expect(mockCacheRequest.delete).toHaveBeenCalledWith('key-to-remove');
        });
    });

    // ── exists() ─────────────────────────────────────────────────────

    describe('exists()', () => {
        it('returns true when key exists', async () => {
            mockCacheRequest.exists.mockResolvedValue(true);
            const cache = new CacheInstance('RAM' as any);

            const result = await cache.exists('present-key');

            expect(mockCacheRequest.exists).toHaveBeenCalledWith('present-key');
            expect(result).toBe(true);
        });

        it('returns false when key does not exist', async () => {
            mockCacheRequest.exists.mockResolvedValue(false);
            const cache = new CacheInstance('RAM' as any);

            const result = await cache.exists('missing-key');
            expect(result).toBe(false);
        });
    });

    // ── getTTL() ─────────────────────────────────────────────────────

    describe('getTTL()', () => {
        it('returns the remaining TTL in seconds', async () => {
            mockCacheRequest.getTTL.mockResolvedValue(1800);
            const cache = new CacheInstance('RAM' as any);

            const ttl = await cache.getTTL('expiring-key');

            expect(mockCacheRequest.getTTL).toHaveBeenCalledWith('expiring-key');
            expect(ttl).toBe(1800);
        });
    });

    // ── updateTTL() ──────────────────────────────────────────────────

    describe('updateTTL()', () => {
        it('delegates with key and ttl', async () => {
            mockCacheRequest.updateTTL.mockResolvedValue(undefined);
            const cache = new CacheInstance('RAM' as any);

            await cache.updateTTL('key', 7200);

            expect(mockCacheRequest.updateTTL).toHaveBeenCalledWith('key', 7200);
        });

        it('delegates without ttl when not provided', async () => {
            mockCacheRequest.updateTTL.mockResolvedValue(undefined);
            const cache = new CacheInstance('RAM' as any);

            await cache.updateTTL('key');

            expect(mockCacheRequest.updateTTL).toHaveBeenCalledWith('key', undefined);
        });
    });
});
