// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock state (hoisted for vi.mock factory)
// ---------------------------------------------------------------------------
const {
    mockNamespaceExists, mockCreateNamespace, mockCreateDatasource,
    mockSearch, mockDeleteDatasource, mockDeleteNamespace,
} = vi.hoisted(() => ({
    mockNamespaceExists: vi.fn().mockResolvedValue(true),
    mockCreateNamespace: vi.fn().mockResolvedValue(undefined),
    mockCreateDatasource: vi.fn().mockResolvedValue('doc-id-1'),
    mockSearch: vi.fn().mockResolvedValue([]),
    mockDeleteDatasource: vi.fn().mockResolvedValue(undefined),
    mockDeleteNamespace: vi.fn().mockResolvedValue(undefined),
}));

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
            getVectorDBConnector(providerId?: string) {
                if (!mockConnectorValid) return null;
                return {
                    valid: true,
                    instance: () => ({
                        requester: () => ({
                            namespaceExists: mockNamespaceExists,
                            createNamespace: mockCreateNamespace,
                            createDatasource: mockCreateDatasource,
                            search: mockSearch,
                            deleteDatasource: mockDeleteDatasource,
                            deleteNamespace: mockDeleteNamespace,
                        }),
                    }),
                    settings: {},
                    requester: () => ({
                        namespaceExists: mockNamespaceExists,
                        createNamespace: mockCreateNamespace,
                        createDatasource: mockCreateDatasource,
                        search: mockSearch,
                        deleteDatasource: mockDeleteDatasource,
                        deleteNamespace: mockDeleteNamespace,
                    }),
                };
            },
            init(type: string, providerId: string, name: string, settings: any) {
                if (!mockInitValid) return { valid: false };
                return {
                    valid: true,
                    instance: () => ({
                        requester: () => ({
                            namespaceExists: mockNamespaceExists,
                            createNamespace: mockCreateNamespace,
                            createDatasource: mockCreateDatasource,
                            search: mockSearch,
                            deleteDatasource: mockDeleteDatasource,
                            deleteNamespace: mockDeleteNamespace,
                        }),
                    }),
                    settings: {},
                };
            },
            getModelsProviderConnector() { return null; },
            getLLMConnector() { return null; },
            getStorageConnector() { return null; },
        },
        TConnectorService: { VectorDB: 'VectorDB' },
        TVectorDBProvider: { default: 'default', RAMVec: 'RAMVec', Pinecone: 'Pinecone' },
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
    };
});

import { VectorDBInstance } from '../../../src/VectorDB/VectorDBInstance.class';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('VectorDBInstance (mocked)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockConnectorValid = true;
        mockInitValid = true;
        mockNamespaceExists.mockResolvedValue(true);
        mockCreateDatasource.mockResolvedValue('doc-id-1');
        mockSearch.mockResolvedValue([]);
    });

    // ── Constructor ──────────────────────────────────────────────────

    describe('constructor', () => {
        it('creates instance with provider and namespace', () => {
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'test-ns' });
            expect(vdb).toBeInstanceOf(VectorDBInstance);
        });

        it('creates instance with default provider', () => {
            const vdb = new VectorDBInstance('default' as any, { namespace: 'test-ns' });
            expect(vdb).toBeInstanceOf(VectorDBInstance);
        });

        it('falls back to ConnectorService.init for unknown providers', async () => {
            mockConnectorValid = false;
            mockInitValid = true;
            const vdb = new VectorDBInstance('Pinecone' as any, { namespace: 'ns' });
            await vdb.ready;
            expect(vdb).toBeInstanceOf(VectorDBInstance);
        });

        // Note: Testing invalid provider throw is tricky because SDKObject runs
        // init() in the ControlledPromise constructor, causing an unhandled rejection.
        // This is verified by the constructor's init path in integration tests instead.
    });

    // ── insertDoc() ──────────────────────────────────────────────────

    describe('insertDoc()', () => {
        it('inserts a string document', async () => {
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'test-ns' });
            await vdb.ready;
            const id = await vdb.insertDoc('doc1', 'Hello world');
            expect(mockCreateDatasource).toHaveBeenCalledWith('test-ns', expect.objectContaining({
                text: 'Hello world',
                id: 'doc1',
                label: 'doc1',
            }));
            expect(id).toBe('doc-id-1');
        });

        it('normalizes document name (lowercase, non-alnum to underscore)', async () => {
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            await vdb.insertDoc('My Doc!', 'content');
            expect(mockCreateDatasource).toHaveBeenCalledWith('ns', expect.objectContaining({
                id: 'my_doc_',
                label: 'My Doc!',
            }));
        });

        it('passes metadata through', async () => {
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            await vdb.insertDoc('doc1', 'text', { metadata: { tag: 'test' } });
            expect(mockCreateDatasource).toHaveBeenCalledWith('ns', expect.objectContaining({
                metadata: { tag: 'test' },
            }));
        });

        it('passes chunkSize and chunkOverlap', async () => {
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            await vdb.insertDoc('doc1', 'text', { chunkSize: 500, chunkOverlap: 50 });
            expect(mockCreateDatasource).toHaveBeenCalledWith('ns', expect.objectContaining({
                chunkSize: 500,
                chunkOverlap: 50,
            }));
        });

        it('inserts parsed document page by page', async () => {
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            const parsedDoc = {
                title: 'Test Doc',
                metadata: { author: 'Tester' },
                pages: [
                    { content: [{ text: 'Page 1 text' }], metadata: { pageNumber: 1 } },
                    { content: [{ text: 'Page 2 text' }], metadata: { pageNumber: 2 } },
                ],
            };
            const ids = await vdb.insertDoc('doc', parsedDoc as any);
            expect(mockCreateDatasource).toHaveBeenCalledTimes(2);
            expect(Array.isArray(ids)).toBe(true);
        });

        it('includes docTitle and author in parsed doc metadata', async () => {
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            const parsedDoc = {
                title: 'My Title',
                metadata: { author: 'Author' },
                pages: [{ content: [{ text: 'text' }], metadata: { pageNumber: 1 } }],
            };
            await vdb.insertDoc('doc', parsedDoc as any);
            expect(mockCreateDatasource).toHaveBeenCalledWith('ns', expect.objectContaining({
                metadata: expect.objectContaining({
                    docTitle: 'My Title',
                    author: 'Author',
                    pageNumber: 1,
                }),
            }));
        });

        it('creates namespace if it does not exist', async () => {
            mockNamespaceExists.mockResolvedValue(false);
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'new-ns' });
            await vdb.ready;
            await vdb.insertDoc('doc', 'text');
            expect(mockCreateNamespace).toHaveBeenCalledWith('new-ns');
        });

        it('warns on invalid options', async () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            await vdb.insertDoc('doc', 'text', { badOption: true } as any);
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        it('does not warn on valid options', async () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            await vdb.insertDoc('doc', 'text', { metadata: {}, chunkSize: 100 });
            expect(warnSpy).not.toHaveBeenCalled();
            warnSpy.mockRestore();
        });
    });

    // ── updateDoc() ──────────────────────────────────────────────────

    describe('updateDoc()', () => {
        it('delegates to insertDoc (additive update)', async () => {
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            const id = await vdb.updateDoc('doc', 'new text');
            expect(mockCreateDatasource).toHaveBeenCalled();
            expect(id).toBe('doc-id-1');
        });
    });

    // ── deleteDoc() ──────────────────────────────────────────────────

    describe('deleteDoc()', () => {
        it('returns true when namespace exists and delete succeeds', async () => {
            mockNamespaceExists.mockResolvedValue(true);
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            const result = await vdb.deleteDoc('doc');
            expect(result).toBe(true);
            expect(mockDeleteDatasource).toHaveBeenCalledWith('ns', 'doc');
        });

        it('returns false when namespace does not exist', async () => {
            mockNamespaceExists.mockResolvedValue(false);
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            const result = await vdb.deleteDoc('doc');
            expect(result).toBe(false);
            expect(mockDeleteDatasource).not.toHaveBeenCalled();
        });
    });

    // ── search() ─────────────────────────────────────────────────────

    describe('search()', () => {
        it('returns empty array when namespace does not exist', async () => {
            mockNamespaceExists.mockResolvedValue(false);
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            const results = await vdb.search('query');
            expect(results).toEqual([]);
            expect(mockSearch).not.toHaveBeenCalled();
        });

        it('returns mapped results with text and metadata', async () => {
            mockNamespaceExists.mockResolvedValue(true);
            mockSearch.mockResolvedValue([
                { text: 'hello', metadata: { tag: 'greeting' }, values: [0.1, 0.2] },
                { text: 'world', metadata: '{"tag":"global"}', values: [0.3, 0.4] },
            ]);
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            const results = await vdb.search('hello');
            expect(results).toHaveLength(2);
            expect(results[0].text).toBe('hello');
            expect(results[0].metadata).toEqual({ tag: 'greeting' });
            expect(results[0].embedding).toBeUndefined();
        });

        it('parses JSON string metadata', async () => {
            mockNamespaceExists.mockResolvedValue(true);
            mockSearch.mockResolvedValue([
                { text: 'data', metadata: '{"key":"val"}', values: [] },
            ]);
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            const results = await vdb.search('data');
            expect(results[0].metadata).toEqual({ key: 'val' });
        });

        it('includes embeddings when option is set', async () => {
            mockNamespaceExists.mockResolvedValue(true);
            mockSearch.mockResolvedValue([
                { text: 'doc', metadata: {}, values: [0.1, 0.2, 0.3] },
            ]);
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            const results = await vdb.search('doc', { includeEmbeddings: true });
            expect(results[0].embedding).toEqual([0.1, 0.2, 0.3]);
        });

        it('defaults topK to 10', async () => {
            mockNamespaceExists.mockResolvedValue(true);
            mockSearch.mockResolvedValue([]);
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            await vdb.search('query');
            expect(mockSearch).toHaveBeenCalledWith('ns', 'query', { topK: 10, includeMetadata: true });
        });

        it('passes custom topK', async () => {
            mockNamespaceExists.mockResolvedValue(true);
            mockSearch.mockResolvedValue([]);
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            await vdb.search('query', { topK: 5 });
            expect(mockSearch).toHaveBeenCalledWith('ns', 'query', { topK: 5, includeMetadata: true });
        });
    });

    // ── purge() ──────────────────────────────────────────────────────

    describe('purge()', () => {
        it('deletes namespace when it exists', async () => {
            mockNamespaceExists.mockResolvedValue(true);
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            await vdb.purge();
            expect(mockDeleteNamespace).toHaveBeenCalledWith('ns');
        });

        it('does nothing when namespace does not exist', async () => {
            mockNamespaceExists.mockResolvedValue(false);
            const vdb = new VectorDBInstance('RAMVec' as any, { namespace: 'ns' });
            await vdb.ready;
            await vdb.purge();
            expect(mockDeleteNamespace).not.toHaveBeenCalled();
        });
    });
});
