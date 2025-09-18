import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { WeaviateVectorDB, WeaviateConfig } from '../../../src/subsystems/IO/VectorDB.service/connectors/WeaviateVectorDB.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { setupSRE } from '../../utils/sre';

// Mock Weaviate client
const mockWeaviateClient = {
    schema: {
        classCreator: vi.fn().mockReturnThis(),
        classDeleter: vi.fn().mockReturnThis(),
        getter: vi.fn().mockReturnThis(),
        withClass: vi.fn().mockReturnThis(),
        withClassName: vi.fn().mockReturnThis(),
        do: vi.fn(),
    },
    data: {
        creator: vi.fn().mockReturnThis(),
        deleter: vi.fn().mockReturnThis(),
        withClassName: vi.fn().mockReturnThis(),
        withId: vi.fn().mockReturnThis(),
        withProperties: vi.fn().mockReturnThis(),
        withVector: vi.fn().mockReturnThis(),
        do: vi.fn(),
    },
    batch: {
        objectsBatchDeleter: vi.fn().mockReturnThis(),
        withClassName: vi.fn().mockReturnThis(),
        withWhere: vi.fn().mockReturnThis(),
        do: vi.fn(),
    },
    graphql: {
        get: vi.fn().mockReturnThis(),
        withClassName: vi.fn().mockReturnThis(),
        withFields: vi.fn().mockReturnThis(),
        withNearVector: vi.fn().mockReturnThis(),
        withLimit: vi.fn().mockReturnThis(),
        withWhere: vi.fn().mockReturnThis(),
        do: vi.fn(),
    },
};

// Mock weaviate-ts-client
vi.mock('weaviate-ts-client', () => ({
    default: {
        client: vi.fn(() => mockWeaviateClient),
    },
    ApiKey: vi.fn(),
}));

// Mock connectors
const mockNKVConnector = {
    requester: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
    })),
};

const mockCacheConnector = {
    requester: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
    })),
};

const mockAccountConnector = {
    requester: vi.fn(),
};

// Mock ConnectorService
vi.mock('@sre/Core/ConnectorsService', () => ({
    ConnectorService: {
        init: vi.fn(),
        register: vi.fn(),
        getNKVConnector: vi.fn(() => mockNKVConnector),
        getCacheConnector: vi.fn(() => mockCacheConnector),
        getAccountConnector: vi.fn(() => mockAccountConnector),
        _stop: vi.fn(),
    },
    ConnectorServiceProvider: class MockConnectorServiceProvider {
        register() {}
    },
}));

// Mock EmbeddingsFactory
vi.mock('@sre/subsystems/IO/VectorDB.service/embed', () => ({
    EmbeddingsFactory: {
        create: vi.fn(() => ({
            embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
        })),
    },
}));

describe('WeaviateVectorDB Connector', () => {
    let connector: WeaviateVectorDB;
    let testConfig: WeaviateConfig;
    let testCandidate: AccessCandidate;
    let testAccessRequest: AccessRequest;

    beforeEach(() => {
        // Setup SRE for testing
        setupSRE({
            VectorDB: {
                Connector: 'Weaviate',
                Settings: {
                    url: 'http://localhost:8080',
                    apiKey: 'test-api-key',
                    className: 'TestClass',
                    embeddings: {
                        provider: 'OpenAI',
                        params: { dimensions: 1536 },
                    },
                },
            },
        });

        testConfig = {
            url: 'http://localhost:8080',
            apiKey: 'test-api-key',
            className: 'TestClass',
            embeddings: {
                provider: 'OpenAI' as any,
                params: { dimensions: 1536 },
            },
        };

        testCandidate = new AccessCandidate('test-user', TAccessRole.User);
        testAccessRequest = new AccessRequest(testCandidate, TAccessLevel.Read);

        connector = new WeaviateVectorDB(testConfig);

        // Reset all mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Constructor and Initialization', () => {
        it('should initialize with valid configuration', () => {
            expect(connector.name).toBe('WeaviateVectorDB');
            expect(connector.id).toBe('weaviate');
            expect(connector._settings).toEqual(testConfig);
        });

        it('should handle missing URL gracefully', () => {
            const invalidConfig = { ...testConfig, url: '' };
            const invalidConnector = new WeaviateVectorDB(invalidConfig);
            
            expect(invalidConnector.client).toBeNull();
            expect(invalidConnector.className).toBe('SmythVector');
        });

        it('should initialize with default className when not provided', () => {
            const configWithoutClassName = { ...testConfig };
            delete configWithoutClassName.className;
            
            const connectorWithoutClassName = new WeaviateVectorDB(configWithoutClassName);
            expect(connectorWithoutClassName.className).toBe('SmythVector');
        });

        it('should set default embedding dimensions', () => {
            const configWithoutDimensions = {
                ...testConfig,
                embeddings: { provider: 'OpenAI' as any },
            };
            
            const connectorWithoutDimensions = new WeaviateVectorDB(configWithoutDimensions);
            expect(connectorWithoutDimensions._settings.embeddings.params.dimensions).toBe(1536);
        });
    });

    describe('Namespace Management', () => {
        beforeEach(() => {
            mockWeaviateClient.schema.getter().do.mockResolvedValue({
                classes: [{ class: 'TestClass_user_test-namespace' }],
            });
        });

        it('should create namespace successfully', async () => {
            mockWeaviateClient.schema.classCreator().withClass().do.mockResolvedValue({});

            await connector.createNamespace(testAccessRequest, 'test-namespace');

            expect(mockWeaviateClient.schema.classCreator).toHaveBeenCalled();
            expect(mockWeaviateClient.schema.classCreator().withClass).toHaveBeenCalledWith(
                expect.objectContaining({
                    class: 'TestClass_user_test-namespace',
                    description: 'SmythOS vector storage for namespace: test-namespace',
                    vectorizer: 'none',
                })
            );
        });

        it('should not create namespace if it already exists', async () => {
            mockWeaviateClient.schema.getter().do.mockResolvedValue({
                classes: [{ class: 'TestClass_user_test-namespace' }],
            });

            await connector.createNamespace(testAccessRequest, 'test-namespace');

            expect(mockWeaviateClient.schema.classCreator().withClass().do).not.toHaveBeenCalled();
        });

        it('should delete namespace successfully', async () => {
            mockWeaviateClient.schema.classDeleter().withClassName().do.mockResolvedValue({});

            await connector.deleteNamespace(testAccessRequest, 'test-namespace');

            expect(mockWeaviateClient.schema.classDeleter).toHaveBeenCalled();
            expect(mockWeaviateClient.schema.classDeleter().withClassName).toHaveBeenCalledWith('TestClass_user_test-namespace');
        });

        it('should check namespace existence correctly', async () => {
            mockWeaviateClient.schema.getter().do.mockResolvedValue({
                classes: [{ class: 'TestClass_user_test-namespace' }],
            });

            const exists = await connector.namespaceExists(testAccessRequest, 'test-namespace');

            expect(exists).toBe(true);
            expect(mockWeaviateClient.schema.getter).toHaveBeenCalled();
        });

        it('should return false for non-existent namespace', async () => {
            mockWeaviateClient.schema.getter().do.mockResolvedValue({
                classes: [],
            });

            const exists = await connector.namespaceExists(testAccessRequest, 'non-existent-namespace');

            expect(exists).toBe(false);
        });
    });

    describe('Vector Operations', () => {
        beforeEach(() => {
            mockWeaviateClient.schema.getter().do.mockResolvedValue({
                classes: [{ class: 'TestClass_user_test-namespace' }],
            });
        });

        it('should insert vectors successfully', async () => {
            const testData = {
                id: 'test-id',
                text: 'test content',
                metadata: { test: 'metadata' },
            };

            mockWeaviateClient.data.creator().withClassName().withId().withProperties().withVector().do.mockResolvedValue({
                id: 'test-id',
            });

            const result = await connector.insert(testAccessRequest, 'test-namespace', testData);

            expect(result).toEqual(['test-id']);
            expect(mockWeaviateClient.data.creator).toHaveBeenCalled();
            expect(mockWeaviateClient.data.creator().withClassName).toHaveBeenCalledWith('TestClass_user_test-namespace');
            expect(mockWeaviateClient.data.creator().withId).toHaveBeenCalledWith('test-id');
        });

        it('should insert multiple vectors', async () => {
            const testData = [
                { id: 'test-id-1', text: 'test content 1', metadata: {} },
                { id: 'test-id-2', text: 'test content 2', metadata: {} },
            ];

            mockWeaviateClient.data.creator().withClassName().withId().withProperties().withVector().do
                .mockResolvedValueOnce({ id: 'test-id-1' })
                .mockResolvedValueOnce({ id: 'test-id-2' });

            const result = await connector.insert(testAccessRequest, 'test-namespace', testData);

            expect(result).toEqual(['test-id-1', 'test-id-2']);
            expect(mockWeaviateClient.data.creator().withClassName().withId().withProperties().withVector().do).toHaveBeenCalledTimes(2);
        });

        it('should search vectors successfully', async () => {
            const mockSearchResults = {
                data: {
                    Get: {
                        'TestClass_user_test-namespace': [
                            {
                                _additional: { id: 'test-id', distance: 0.2 },
                                content: 'test content',
                                metadata: { test: 'metadata' },
                            },
                        ],
                    },
                },
            };

            mockWeaviateClient.graphql.get().withClassName().withFields().withNearVector().withLimit().withWhere().do.mockResolvedValue(mockSearchResults);

            const result = await connector.search(testAccessRequest, 'test-namespace', 'test query', {
                topK: 10,
                threshold: 0.8,
            });

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('test-id');
            expect(result[0].score).toBe(0.8); // 1 - distance
            expect(result[0].text).toBe('test content');
        });

        it('should return empty results for non-existent namespace', async () => {
            mockWeaviateClient.schema.getter().do.mockResolvedValue({
                classes: [],
            });

            const result = await connector.search(testAccessRequest, 'non-existent-namespace', 'test query', {
                topK: 10,
            });

            expect(result).toEqual([]);
        });

        it('should delete vectors by ID', async () => {
            mockWeaviateClient.data.deleter().withClassName().withId().do.mockResolvedValue({});

            await connector.delete(testAccessRequest, 'test-namespace', 'test-id');

            expect(mockWeaviateClient.data.deleter).toHaveBeenCalled();
            expect(mockWeaviateClient.data.deleter().withClassName).toHaveBeenCalledWith('TestClass_user_test-namespace');
            expect(mockWeaviateClient.data.deleter().withId).toHaveBeenCalledWith('test-id');
        });

        it('should delete multiple vectors by IDs', async () => {
            const ids = ['test-id-1', 'test-id-2'];
            mockWeaviateClient.data.deleter().withClassName().withId().do.mockResolvedValue({});

            await connector.delete(testAccessRequest, 'test-namespace', ids);

            expect(mockWeaviateClient.data.deleter().withClassName().withId().do).toHaveBeenCalledTimes(2);
        });

        it('should delete vectors by datasource ID', async () => {
            mockWeaviateClient.batch.objectsBatchDeleter().withClassName().withWhere().do.mockResolvedValue({});

            await connector.delete(testAccessRequest, 'test-namespace', { datasourceId: 'test-datasource' });

            expect(mockWeaviateClient.batch.objectsBatchDeleter).toHaveBeenCalled();
            expect(mockWeaviateClient.batch.objectsBatchDeleter().withClassName).toHaveBeenCalledWith('TestClass_user_test-namespace');
        });
    });

    describe('Datasource Management', () => {
        beforeEach(() => {
            mockNKVConnector.requester().set.mockResolvedValue(undefined);
            mockNKVConnector.requester().get.mockResolvedValue(JSON.stringify({
                id: 'test-datasource',
                namespace: 'TestClass_user_test-namespace',
                metadata: {},
                createdAt: '2023-01-01T00:00:00.000Z',
            }));
            mockNKVConnector.requester().list.mockResolvedValue([
                { key: 'datasource:TestClass_user_test-namespace:test-datasource', data: 'test-data' },
            ]);
            mockNKVConnector.requester().delete.mockResolvedValue(undefined);
        });

        it('should create datasource successfully', async () => {
            const datasourceData = {
                text: 'test datasource content',
                metadata: { test: 'metadata' },
                label: 'Test Datasource',
            };

            const result = await connector.createDatasource(testAccessRequest, 'test-namespace', datasourceData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.namespace).toBe('TestClass_user_test-namespace');
            expect(mockNKVConnector.requester().set).toHaveBeenCalled();
        });

        it('should delete datasource successfully', async () => {
            await connector.deleteDatasource(testAccessRequest, 'test-namespace', 'test-datasource');

            expect(mockNKVConnector.requester().delete).toHaveBeenCalledWith(
                'weaviate',
                'datasource:TestClass_user_test-namespace:test-datasource'
            );
        });

        it('should list datasources successfully', async () => {
            const result = await connector.listDatasources(testAccessRequest, 'test-namespace');

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(mockNKVConnector.requester().list).toHaveBeenCalledWith('weaviate');
        });

        it('should get specific datasource', async () => {
            const result = await connector.getDatasource(testAccessRequest, 'test-namespace', 'test-datasource');

            expect(result).toBeDefined();
            expect(mockNKVConnector.requester().get).toHaveBeenCalledWith(
                'weaviate',
                'datasource:TestClass_user_test-namespace:test-datasource'
            );
        });
    });

    describe('ACL and Security', () => {
        beforeEach(() => {
            mockCacheConnector.requester().get.mockResolvedValue(null);
            mockCacheConnector.requester().set.mockResolvedValue(undefined);
        });

        it('should get resource ACL for existing resource', async () => {
            const mockACL = { entries: {}, hashAlgorithm: 'xxh3' };
            mockCacheConnector.requester().get.mockResolvedValue(JSON.stringify(mockACL));

            const acl = await connector.getResourceACL('test-resource', testCandidate);

            expect(acl).toBeInstanceOf(ACL);
        });

        it('should create default ACL for non-existent resource', async () => {
            mockCacheConnector.requester().get.mockResolvedValue(null);
            mockWeaviateClient.schema.getter().do.mockResolvedValue({
                classes: [],
            });

            const acl = await connector.getResourceACL('non-existent-resource', testCandidate);

            expect(acl).toBeInstanceOf(ACL);
            expect(acl.checkExactAccess({
                candidate: testCandidate,
                level: TAccessLevel.Owner,
            })).toBe(true);
        });

        it('should handle ACL caching', async () => {
            const mockACL = { entries: {}, hashAlgorithm: 'xxh3' };
            mockCacheConnector.requester().get.mockResolvedValue(JSON.stringify(mockACL));

            await connector.getResourceACL('test-resource', testCandidate);

            expect(mockCacheConnector.requester().get).toHaveBeenCalledWith('acl:TestClass_user_test-resource:test-user');
        });
    });

    describe('Error Handling', () => {
        it('should handle Weaviate client errors gracefully', async () => {
            const error = new Error('Weaviate connection failed');
            mockWeaviateClient.schema.getter().do.mockRejectedValue(error);

            await expect(connector.namespaceExists(testAccessRequest, 'test-namespace'))
                .rejects.toThrow('Failed to check namespace existence test-namespace');
        });

        it('should handle insert errors', async () => {
            const error = new Error('Insert failed');
            mockWeaviateClient.data.creator().withClassName().withId().withProperties().withVector().do.mockRejectedValue(error);

            await expect(connector.insert(testAccessRequest, 'test-namespace', {
                id: 'test-id',
                text: 'test content',
            })).rejects.toThrow('Failed to insert data into namespace test-namespace');
        });

        it('should handle search errors', async () => {
            const error = new Error('Search failed');
            mockWeaviateClient.graphql.get().withClassName().withFields().withNearVector().withLimit().withWhere().do.mockRejectedValue(error);

            await expect(connector.search(testAccessRequest, 'test-namespace', 'test query', {
                topK: 10,
            })).rejects.toThrow('Failed to search in namespace test-namespace');
        });

        it('should handle delete errors', async () => {
            const error = new Error('Delete failed');
            mockWeaviateClient.data.deleter().withClassName().withId().do.mockRejectedValue(error);

            await expect(connector.delete(testAccessRequest, 'test-namespace', 'test-id'))
                .rejects.toThrow('Failed to delete from namespace test-namespace');
        });

        it('should handle datasource creation errors', async () => {
            const error = new Error('NKV set failed');
            mockNKVConnector.requester().set.mockRejectedValue(error);

            await expect(connector.createDatasource(testAccessRequest, 'test-namespace', {
                text: 'test content',
            })).rejects.toThrow('Failed to create datasource');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty search results', async () => {
            mockWeaviateClient.schema.getter().do.mockResolvedValue({
                classes: [{ class: 'TestClass_user_test-namespace' }],
            });
            mockWeaviateClient.graphql.get().withClassName().withFields().withNearVector().withLimit().withWhere().do.mockResolvedValue({
                data: { Get: { 'TestClass_user_test-namespace': [] } },
            });

            const result = await connector.search(testAccessRequest, 'test-namespace', 'test query', {
                topK: 10,
            });

            expect(result).toEqual([]);
        });

        it('should handle null search results', async () => {
            mockWeaviateClient.schema.getter().do.mockResolvedValue({
                classes: [{ class: 'TestClass_user_test-namespace' }],
            });
            mockWeaviateClient.graphql.get().withClassName().withFields().withNearVector().withLimit().withWhere().do.mockResolvedValue({
                data: { Get: null },
            });

            const result = await connector.search(testAccessRequest, 'test-namespace', 'test query', {
                topK: 10,
            });

            expect(result).toEqual([]);
        });

        it('should handle missing metadata in search results', async () => {
            mockWeaviateClient.schema.getter().do.mockResolvedValue({
                classes: [{ class: 'TestClass_user_test-namespace' }],
            });
            mockWeaviateClient.graphql.get().withClassName().withFields().withNearVector().withLimit().withWhere().do.mockResolvedValue({
                data: {
                    Get: {
                        'TestClass_user_test-namespace': [
                            {
                                _additional: { id: 'test-id', distance: 0.2 },
                                content: 'test content',
                                // metadata is missing
                            },
                        ],
                    },
                },
            });

            const result = await connector.search(testAccessRequest, 'test-namespace', 'test query', {
                topK: 10,
            });

            expect(result).toHaveLength(1);
            expect(result[0].metadata).toEqual({ content: 'test content' });
        });

        it('should handle vector insertion without text', async () => {
            const testData = {
                id: 'test-id',
                vector: [0.1, 0.2, 0.3, 0.4, 0.5],
                metadata: { test: 'metadata' },
            };

            mockWeaviateClient.data.creator().withClassName().withId().withProperties().withVector().do.mockResolvedValue({
                id: 'test-id',
            });

            const result = await connector.insert(testAccessRequest, 'test-namespace', testData);

            expect(result).toEqual(['test-id']);
        });

        it('should throw error when neither vector nor text is provided', async () => {
            const testData = {
                id: 'test-id',
                metadata: { test: 'metadata' },
            };

            await expect(connector.insert(testAccessRequest, 'test-namespace', testData))
                .rejects.toThrow('Either vector or text must be provided');
        });
    });

    describe('Stop Method', () => {
        it('should stop connector gracefully', async () => {
            await expect(connector.stop()).resolves.not.toThrow();
        });
    });
});
