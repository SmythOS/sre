// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@smythos/sre', async () => {
    return {
        DEFAULT_TEAM_ID: 'default',
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id }),
            agent: (id: string) => ({ type: 'agent', id }),
        },
        ConnectorService: {
            getVectorDBConnector() {
                return {
                    valid: true,
                    instance: () => ({
                        requester: () => ({
                            namespaceExists: vi.fn().mockResolvedValue(true),
                            createNamespace: vi.fn(),
                            createDatasource: vi.fn(),
                            search: vi.fn().mockResolvedValue([]),
                            deleteDatasource: vi.fn(),
                            deleteNamespace: vi.fn(),
                        }),
                    }),
                    settings: {},
                    requester: () => ({
                        namespaceExists: vi.fn().mockResolvedValue(true),
                        createNamespace: vi.fn(),
                        createDatasource: vi.fn(),
                        search: vi.fn().mockResolvedValue([]),
                        deleteDatasource: vi.fn(),
                        deleteNamespace: vi.fn(),
                    }),
                };
            },
            init() {
                return {
                    valid: true,
                    instance: () => ({
                        requester: () => ({
                            namespaceExists: vi.fn().mockResolvedValue(true),
                            createNamespace: vi.fn(),
                        }),
                    }),
                    settings: {},
                };
            },
            getModelsProviderConnector() { return null; },
            getLLMConnector() { return null; },
        },
        TConnectorService: { VectorDB: 'VectorDB' },
        TVectorDBProvider: { default: 'default', RAMVec: 'RAMVec', Pinecone: 'Pinecone' },
        Scope: { TEAM: 'team', AGENT: 'agent' },
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
    };
});

import { VectorDB } from '../../../src/VectorDB/VectorDB.class';

// ---------------------------------------------------------------------------
// VectorDB factory
// ---------------------------------------------------------------------------
describe('VectorDB factory', () => {
    it('has factory methods for each provider', () => {
        expect(typeof VectorDB.default).toBe('function');
        expect(typeof VectorDB.RAMVec).toBe('function');
    });

    it('creates VectorDBInstance with namespace', () => {
        const instance = VectorDB.RAMVec('my-namespace');
        expect(instance).toBeDefined();
        expect(typeof instance.insertDoc).toBe('function');
        expect(typeof instance.search).toBe('function');
    });

    it('passes settings to instance', () => {
        const instance = VectorDB.RAMVec('ns', { dimensions: 1536 });
        expect(instance).toBeDefined();
    });

    it('extracts scope from settings', () => {
        const instance = VectorDB.RAMVec('ns', { scope: 'team' });
        expect(instance).toBeDefined();
    });

    it('warns for string scope (invalid type)', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        VectorDB.RAMVec('ns', {}, 'bad-scope' as any);
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('creates with default provider', () => {
        const instance = VectorDB.default('ns');
        expect(instance).toBeDefined();
    });
});
