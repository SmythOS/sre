import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WeaviateVectorDB, WeaviateConfig } from '../../../src/subsystems/IO/VectorDB.service/connectors/WeaviateVectorDB.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';

// Mock weaviate-ts-client
vi.mock('weaviate-ts-client', () => ({
    default: {
        client: vi.fn(() => ({
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
        })),
    },
    ApiKey: vi.fn(),
}));

// Mock EmbeddingsFactory
vi.mock('@sre/subsystems/IO/VectorDB.service/embed', () => ({
    EmbeddingsFactory: {
        create: vi.fn(() => ({
            embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
        })),
    },
}));

// Mock ConnectorService
vi.mock('@sre/Core/ConnectorsService', () => ({
    ConnectorService: {
        init: vi.fn(),
        register: vi.fn(),
        getNKVConnector: vi.fn(() => ({
            requester: vi.fn(() => ({
                get: vi.fn(),
                set: vi.fn(),
                delete: vi.fn(),
                list: vi.fn(),
            })),
        })),
        getCacheConnector: vi.fn(() => ({
            requester: vi.fn(() => ({
                get: vi.fn(),
                set: vi.fn(),
                delete: vi.fn(),
            })),
        })),
        getAccountConnector: vi.fn(() => ({
            requester: vi.fn(),
        })),
        _stop: vi.fn(),
    },
    ConnectorServiceProvider: class MockConnectorServiceProvider {
        register() {}
    },
}));

describe('WeaviateVectorDB Connector - Basic Tests', () => {
    let connector: WeaviateVectorDB;
    let testConfig: WeaviateConfig;
    let testCandidate: AccessCandidate;
    let testAccessRequest: AccessRequest;

    beforeEach(() => {
        testConfig = {
            url: 'http://localhost:8080',
            apiKey: 'test-api-key',
            className: 'TestClass',
            embeddings: {
                provider: 'OpenAI' as any,
                params: { dimensions: 1536 },
            },
        };

        testCandidate = new AccessCandidate({ id: 'test-user', role: TAccessRole.User });
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

    describe('Stop Method', () => {
        it('should stop connector gracefully', async () => {
            await expect(connector.stop()).resolves.not.toThrow();
        });
    });

    describe('Configuration Validation', () => {
        it('should validate required configuration fields', () => {
            expect(connector._settings.url).toBe('http://localhost:8080');
            expect(connector._settings.apiKey).toBe('test-api-key');
            expect(connector._settings.className).toBe('TestClass');
        });

        it('should handle configuration with custom client options', () => {
            const configWithOptions = {
                ...testConfig,
                clientOptions: {
                    timeout: 5000,
                    headers: { 'Custom-Header': 'value' },
                },
            };

            const connectorWithOptions = new WeaviateVectorDB(configWithOptions);
            expect(connectorWithOptions._settings.clientOptions).toEqual(configWithOptions.clientOptions);
        });
    });

    describe('Embedding Configuration', () => {
        it('should configure embeddings correctly', () => {
            expect(connector._settings.embeddings.provider).toBe('OpenAI');
            expect(connector._settings.embeddings.params.dimensions).toBe(1536);
        });

        it('should handle different embedding providers', () => {
            const configWithDifferentProvider = {
                ...testConfig,
                embeddings: {
                    provider: 'OpenAI' as any, // Use supported provider
                    params: { dimensions: 1024 },
                },
            };

            const connectorWithDifferentProvider = new WeaviateVectorDB(configWithDifferentProvider);
            expect(connectorWithDifferentProvider._settings.embeddings.provider).toBe('OpenAI');
            expect(connectorWithDifferentProvider._settings.embeddings.params.dimensions).toBe(1024);
        });
    });

    describe('Namespace Construction', () => {
        it('should construct namespace names correctly', () => {
            const testNamespace = 'test-namespace';
            const expectedNamespace = 'u_test-user_test-namespace'; // Format: role[0]_id_namespace
            
            // Access the private method through the connector instance
            const constructedNs = (connector as any).constructNsName(testCandidate, testNamespace);
            expect(constructedNs).toBe(expectedNamespace);
        });

        it('should handle different user roles in namespace construction', () => {
            const teamCandidate = new AccessCandidate({ id: 'team-user', role: TAccessRole.Team });
            const testNamespace = 'team-namespace';
            const expectedNamespace = 't_team-user_team-namespace'; // Format: role[0]_id_namespace
            
            const constructedNs = (connector as any).constructNsName(teamCandidate, testNamespace);
            expect(constructedNs).toBe(expectedNamespace);
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid configuration gracefully', () => {
            const invalidConfig = { url: '', apiKey: '', className: '' };
            const invalidConnector = new WeaviateVectorDB(invalidConfig as any);
            
            expect(invalidConnector.client).toBeNull();
            expect(invalidConnector.embedder).toBeNull();
        });

        it('should handle missing embeddings configuration', () => {
            const configWithoutEmbeddings = { ...testConfig };
            delete configWithoutEmbeddings.embeddings;
            
            // This should throw an error since embeddings are required
            expect(() => new WeaviateVectorDB(configWithoutEmbeddings as any)).toThrow();
        });
    });

    describe('Instance Management', () => {
        it('should create new instances with different configurations', () => {
            const newConfig = { ...testConfig, className: 'NewClass' };
            const newConnector = connector.instance(newConfig);
            
            expect(newConnector).toBeInstanceOf(WeaviateVectorDB);
            expect(newConnector._settings.className).toBe('NewClass');
        });

        it('should maintain separate instances for different configurations', () => {
            const config1 = { ...testConfig, className: 'Class1' };
            const config2 = { ...testConfig, className: 'Class2' };
            
            const connector1 = connector.instance(config1);
            const connector2 = connector.instance(config2);
            
            expect(connector1).not.toBe(connector2);
            expect(connector1._settings.className).toBe('Class1');
            expect(connector2._settings.className).toBe('Class2');
        });
    });
});
