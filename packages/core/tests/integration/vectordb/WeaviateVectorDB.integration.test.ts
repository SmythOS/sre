import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WeaviateVectorDB, WeaviateConfig } from '../../../src/subsystems/IO/VectorDB.service/connectors/WeaviateVectorDB.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { setupSRE } from '../../utils/sre';

// Integration test configuration
const INTEGRATION_TEST_CONFIG: WeaviateConfig = {
    url: process.env.WEAVIATE_URL || 'http://localhost:8080',
    apiKey: process.env.WEAVIATE_API_KEY || 'test-key',
    className: 'IntegrationTestClass',
    embeddings: {
        provider: 'OpenAI' as any,
        params: { dimensions: 1536 },
    },
};

// Skip integration tests if no Weaviate instance is available
const shouldSkipIntegrationTests = !process.env.WEAVIATE_URL && !process.env.RUN_INTEGRATION_TESTS;

describe.skipIf(shouldSkipIntegrationTests)('WeaviateVectorDB Integration Tests', () => {
    let connector: WeaviateVectorDB;
    let testCandidate: AccessCandidate;
    let testAccessRequest: AccessRequest;
    let testNamespace: string;

    beforeEach(async () => {
        // Setup SRE for integration testing
        setupSRE({
            VectorDB: {
                Connector: 'Weaviate',
                Settings: INTEGRATION_TEST_CONFIG,
            },
        });

        testCandidate = new AccessCandidate('integration-test-user', TAccessRole.User);
        testAccessRequest = new AccessRequest(testCandidate, TAccessLevel.Write);
        testNamespace = `integration-test-${Date.now()}`;

        connector = new WeaviateVectorDB(INTEGRATION_TEST_CONFIG);
    });

    afterEach(async () => {
        // Clean up test namespace
        try {
            await connector.deleteNamespace(testAccessRequest, testNamespace);
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('Full Workflow Integration', () => {
        it('should complete a full vector database workflow', async () => {
            // 1. Create namespace
            await connector.createNamespace(testAccessRequest, testNamespace);
            const namespaceExists = await connector.namespaceExists(testAccessRequest, testNamespace);
            expect(namespaceExists).toBe(true);

            // 2. Insert test vectors
            const testVectors = [
                {
                    id: 'vector-1',
                    text: 'This is a test document about machine learning',
                    metadata: { category: 'AI', type: 'document' },
                },
                {
                    id: 'vector-2',
                    text: 'Another document about artificial intelligence and neural networks',
                    metadata: { category: 'AI', type: 'research' },
                },
                {
                    id: 'vector-3',
                    text: 'A completely different topic about cooking recipes',
                    metadata: { category: 'Food', type: 'recipe' },
                },
            ];

            const insertedIds = await connector.insert(testAccessRequest, testNamespace, testVectors);
            expect(insertedIds).toHaveLength(3);
            expect(insertedIds).toContain('vector-1');
            expect(insertedIds).toContain('vector-2');
            expect(insertedIds).toContain('vector-3');

            // 3. Search for similar vectors
            const searchResults = await connector.search(testAccessRequest, testNamespace, 'machine learning AI', {
                topK: 2,
                threshold: 0.5,
            });

            expect(searchResults.length).toBeGreaterThan(0);
            expect(searchResults.length).toBeLessThanOrEqual(2);

            // Verify search results contain expected content
            const resultTexts = searchResults.map(r => r.text);
            expect(resultTexts.some(text => text.includes('machine learning'))).toBe(true);

            // 4. Create datasource
            const datasourceData = {
                text: 'This is a comprehensive datasource about machine learning algorithms and their applications in real-world scenarios.',
                metadata: { 
                    title: 'ML Algorithms Guide',
                    author: 'Test Author',
                    smyth_metadata: { version: '1.0' }
                },
                label: 'ML Algorithms Datasource',
            };

            const datasource = await connector.createDatasource(testAccessRequest, testNamespace, datasourceData);
            expect(datasource).toBeDefined();
            expect(datasource.id).toBeDefined();
            expect(datasource.namespace).toContain(testNamespace);

            // 5. List datasources
            const datasources = await connector.listDatasources(testAccessRequest, testNamespace);
            expect(datasources).toHaveLength(1);
            expect(datasources[0].id).toBe(datasource.id);

            // 6. Get specific datasource
            const retrievedDatasource = await connector.getDatasource(testAccessRequest, testNamespace, datasource.id);
            expect(retrievedDatasource).toBeDefined();
            expect(retrievedDatasource?.id).toBe(datasource.id);

            // 7. Delete specific vectors
            await connector.delete(testAccessRequest, testNamespace, 'vector-3');
            
            // Verify vector was deleted by searching again
            const searchAfterDelete = await connector.search(testAccessRequest, testNamespace, 'cooking recipes', {
                topK: 5,
            });
            expect(searchAfterDelete.length).toBe(0);

            // 8. Delete datasource
            await connector.deleteDatasource(testAccessRequest, testNamespace, datasource.id);
            
            // Verify datasource was deleted
            const datasourcesAfterDelete = await connector.listDatasources(testAccessRequest, testNamespace);
            expect(datasourcesAfterDelete).toHaveLength(0);

            // 9. Delete remaining vectors
            await connector.delete(testAccessRequest, testNamespace, ['vector-1', 'vector-2']);

            // 10. Delete namespace
            await connector.deleteNamespace(testAccessRequest, testNamespace);
            const namespaceExistsAfterDelete = await connector.namespaceExists(testAccessRequest, testNamespace);
            expect(namespaceExistsAfterDelete).toBe(false);
        });

        it('should handle concurrent operations', async () => {
            await connector.createNamespace(testAccessRequest, testNamespace);

            // Insert multiple vectors concurrently
            const vectorPromises = Array.from({ length: 10 }, (_, i) => 
                connector.insert(testAccessRequest, testNamespace, {
                    id: `concurrent-vector-${i}`,
                    text: `Concurrent test vector number ${i}`,
                    metadata: { index: i },
                })
            );

            const results = await Promise.all(vectorPromises);
            expect(results).toHaveLength(10);
            expect(results.every(result => result.length === 1)).toBe(true);

            // Search concurrently
            const searchPromises = Array.from({ length: 5 }, () =>
                connector.search(testAccessRequest, testNamespace, 'concurrent test', {
                    topK: 5,
                })
            );

            const searchResults = await Promise.all(searchPromises);
            expect(searchResults).toHaveLength(5);
            expect(searchResults.every(result => Array.isArray(result))).toBe(true);
        });

        it('should handle large datasets', async () => {
            await connector.createNamespace(testAccessRequest, testNamespace);

            // Create a large number of vectors
            const largeDataset = Array.from({ length: 100 }, (_, i) => ({
                id: `large-dataset-${i}`,
                text: `Large dataset vector ${i} with some meaningful content about various topics`,
                metadata: { 
                    index: i,
                    category: i % 3 === 0 ? 'Category A' : i % 3 === 1 ? 'Category B' : 'Category C',
                },
            }));

            // Insert in batches
            const batchSize = 20;
            const batches = [];
            for (let i = 0; i < largeDataset.length; i += batchSize) {
                batches.push(largeDataset.slice(i, i + batchSize));
            }

            for (const batch of batches) {
                const result = await connector.insert(testAccessRequest, testNamespace, batch);
                expect(result).toHaveLength(batch.length);
            }

            // Search and verify results
            const searchResults = await connector.search(testAccessRequest, testNamespace, 'large dataset', {
                topK: 10,
            });

            expect(searchResults.length).toBeGreaterThan(0);
            expect(searchResults.length).toBeLessThanOrEqual(10);

            // Verify all vectors can be found
            const allSearchResults = await connector.search(testAccessRequest, testNamespace, 'meaningful content', {
                topK: 100,
            });

            expect(allSearchResults.length).toBeGreaterThan(50); // Should find many matches
        });

        it('should maintain data consistency across operations', async () => {
            await connector.createNamespace(testAccessRequest, testNamespace);

            // Insert vectors
            const vectors = [
                { id: 'consistency-1', text: 'First vector', metadata: { order: 1 } },
                { id: 'consistency-2', text: 'Second vector', metadata: { order: 2 } },
                { id: 'consistency-3', text: 'Third vector', metadata: { order: 3 } },
            ];

            await connector.insert(testAccessRequest, testNamespace, vectors);

            // Create datasource
            const datasource = await connector.createDatasource(testAccessRequest, testNamespace, {
                text: 'Test datasource for consistency',
                metadata: { test: 'consistency' },
            });

            // Verify all data is accessible
            const searchResults = await connector.search(testAccessRequest, testNamespace, 'vector', {
                topK: 10,
            });
            expect(searchResults.length).toBe(3);

            const datasources = await connector.listDatasources(testAccessRequest, testNamespace);
            expect(datasources.length).toBe(1);

            // Delete one vector
            await connector.delete(testAccessRequest, testNamespace, 'consistency-2');

            // Verify consistency after deletion
            const searchAfterDelete = await connector.search(testAccessRequest, testNamespace, 'vector', {
                topK: 10,
            });
            expect(searchAfterDelete.length).toBe(2);

            // Verify datasource is still accessible
            const datasourcesAfterDelete = await connector.listDatasources(testAccessRequest, testNamespace);
            expect(datasourcesAfterDelete.length).toBe(1);

            // Delete datasource
            await connector.deleteDatasource(testAccessRequest, testNamespace, datasource.id);

            // Verify datasource is deleted but vectors remain
            const datasourcesAfterDatasourceDelete = await connector.listDatasources(testAccessRequest, testNamespace);
            expect(datasourcesAfterDatasourceDelete.length).toBe(0);

            const searchAfterDatasourceDelete = await connector.search(testAccessRequest, testNamespace, 'vector', {
                topK: 10,
            });
            expect(searchAfterDatasourceDelete.length).toBe(2);
        });
    });

    describe('Error Recovery', () => {
        it('should handle network interruptions gracefully', async () => {
            // This test would require mocking network failures
            // For now, we'll test that the connector handles errors properly
            await connector.createNamespace(testAccessRequest, testNamespace);

            // Test that operations fail gracefully with invalid data
            await expect(connector.insert(testAccessRequest, testNamespace, {
                id: 'invalid-vector',
                // Missing both text and vector
            })).rejects.toThrow();
        });

        it('should recover from partial failures', async () => {
            await connector.createNamespace(testAccessRequest, testNamespace);

            // Insert some vectors
            await connector.insert(testAccessRequest, testNamespace, [
                { id: 'recovery-1', text: 'First vector' },
                { id: 'recovery-2', text: 'Second vector' },
            ]);

            // Try to insert invalid data (should fail)
            await expect(connector.insert(testAccessRequest, testNamespace, {
                id: 'invalid',
                // Missing text and vector
            })).rejects.toThrow();

            // Verify that previous data is still intact
            const searchResults = await connector.search(testAccessRequest, testNamespace, 'vector', {
                topK: 10,
            });
            expect(searchResults.length).toBe(2);
        });
    });

    describe('Performance Tests', () => {
        it('should perform well with many small operations', async () => {
            await connector.createNamespace(testAccessRequest, testNamespace);

            const startTime = Date.now();

            // Perform many small operations
            for (let i = 0; i < 50; i++) {
                await connector.insert(testAccessRequest, testNamespace, {
                    id: `perf-${i}`,
                    text: `Performance test vector ${i}`,
                });
            }

            const insertTime = Date.now() - startTime;
            console.log(`Inserted 50 vectors in ${insertTime}ms`);

            // Search performance
            const searchStartTime = Date.now();
            const searchResults = await connector.search(testAccessRequest, testNamespace, 'performance test', {
                topK: 20,
            });
            const searchTime = Date.now() - searchStartTime;
            console.log(`Searched in ${searchTime}ms, found ${searchResults.length} results`);

            expect(searchResults.length).toBeGreaterThan(0);
            expect(insertTime).toBeLessThan(10000); // Should complete within 10 seconds
            expect(searchTime).toBeLessThan(5000); // Search should complete within 5 seconds
        });
    });
});
