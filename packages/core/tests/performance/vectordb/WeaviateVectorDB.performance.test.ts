import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WeaviateVectorDB, WeaviateConfig } from '../../../src/subsystems/IO/VectorDB.service/connectors/WeaviateVectorDB.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { setupSRE } from '../../utils/sre';
import { WeaviateTestUtils } from '../../utils/weaviate-test-utils';

// Performance test configuration
const PERFORMANCE_TEST_CONFIG: WeaviateConfig = {
    url: process.env.WEAVIATE_URL || 'http://localhost:8080',
    apiKey: process.env.WEAVIATE_API_KEY || 'test-key',
    className: 'PerformanceTestClass',
    embeddings: {
        provider: 'OpenAI' as any,
        params: { dimensions: 1536 },
    },
};

// Skip performance tests if no Weaviate instance is available
const shouldSkipPerformanceTests = !process.env.WEAVIATE_URL && !process.env.RUN_PERFORMANCE_TESTS;

describe.skipIf(shouldSkipPerformanceTests)('WeaviateVectorDB Performance Tests', () => {
    let connector: WeaviateVectorDB;
    let testCandidate: AccessCandidate;
    let testAccessRequest: AccessRequest;
    let testNamespace: string;

    beforeEach(async () => {
        setupSRE({
            VectorDB: {
                Connector: 'Weaviate',
                Settings: PERFORMANCE_TEST_CONFIG,
            },
        });

        testCandidate = WeaviateTestUtils.createTestCandidate(TAccessRole.User, 'perf-test-user');
        testAccessRequest = WeaviateTestUtils.createTestAccessRequest(testCandidate, TAccessLevel.Write);
        testNamespace = WeaviateTestUtils.generateTestNamespace('perf');

        connector = new WeaviateVectorDB(PERFORMANCE_TEST_CONFIG);
    });

    afterEach(async () => {
        await WeaviateTestUtils.cleanupTestData(connector, testAccessRequest, testNamespace);
    });

    describe('Insert Performance', () => {
        it('should handle single vector insertion efficiently', async () => {
            await connector.createNamespace(testAccessRequest, testNamespace);

            const testVector = WeaviateTestUtils.createTestVectorData('perf-single', 'Performance test single vector');
            
            const startTime = Date.now();
            const result = await connector.insert(testAccessRequest, testNamespace, testVector);
            const endTime = Date.now();

            const duration = endTime - startTime;
            console.log(`Single vector insertion took ${duration}ms`);

            expect(result).toHaveLength(1);
            expect(result[0]).toBe('perf-single');
            expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
        });

        it('should handle batch vector insertion efficiently', async () => {
            await connector.createNamespace(testAccessRequest, testNamespace);

            const batchSizes = [10, 50, 100];
            
            for (const batchSize of batchSizes) {
                const testVectors = WeaviateTestUtils.createMultipleTestVectors(batchSize);
                
                const startTime = Date.now();
                const result = await connector.insert(testAccessRequest, testNamespace, testVectors);
                const endTime = Date.now();

                const duration = endTime - startTime;
                const vectorsPerSecond = (batchSize / duration) * 1000;
                
                console.log(`Batch insertion of ${batchSize} vectors took ${duration}ms (${vectorsPerSecond.toFixed(2)} vectors/sec)`);

                expect(result).toHaveLength(batchSize);
                expect(duration).toBeLessThan(batchSize * 100); // Should be reasonable per vector
            }
        });

        it('should handle concurrent insertions efficiently', async () => {
            await connector.createNamespace(testAccessRequest, testNamespace);

            const concurrentBatches = 5;
            const batchSize = 20;
            const totalVectors = concurrentBatches * batchSize;

            const startTime = Date.now();
            
            const promises = Array.from({ length: concurrentBatches }, (_, i) => {
                const vectors = WeaviateTestUtils.createMultipleTestVectors(batchSize).map(v => ({
                    ...v,
                    id: `concurrent-${i}-${v.id}`,
                }));
                return connector.insert(testAccessRequest, testNamespace, vectors);
            });

            const results = await Promise.all(promises);
            const endTime = Date.now();

            const duration = endTime - startTime;
            const vectorsPerSecond = (totalVectors / duration) * 1000;
            
            console.log(`Concurrent insertion of ${totalVectors} vectors took ${duration}ms (${vectorsPerSecond.toFixed(2)} vectors/sec)`);

            expect(results).toHaveLength(concurrentBatches);
            expect(results.every(result => result.length === batchSize)).toBe(true);
            expect(duration).toBeLessThan(totalVectors * 50); // Should be efficient even with concurrency
        });
    });

    describe('Search Performance', () => {
        beforeEach(async () => {
            await connector.createNamespace(testAccessRequest, testNamespace);
            
            // Insert test data for search performance tests
            const testVectors = Array.from({ length: 1000 }, (_, i) => ({
                id: `search-perf-${i}`,
                text: `Search performance test vector ${i} with various content about different topics including technology, science, and arts`,
                metadata: { 
                    index: i,
                    category: i % 5 === 0 ? 'Technology' : i % 5 === 1 ? 'Science' : i % 5 === 2 ? 'Arts' : i % 5 === 3 ? 'Sports' : 'Other',
                },
            }));

            // Insert in batches for better performance
            const batchSize = 100;
            for (let i = 0; i < testVectors.length; i += batchSize) {
                const batch = testVectors.slice(i, i + batchSize);
                await connector.insert(testAccessRequest, testNamespace, batch);
            }
        });

        it('should perform fast searches with small result sets', async () => {
            const searchQueries = [
                'technology',
                'science',
                'arts',
                'performance test',
                'various content',
            ];

            for (const query of searchQueries) {
                const startTime = Date.now();
                const results = await connector.search(testAccessRequest, testNamespace, query, {
                    topK: 10,
                    threshold: 0.7,
                });
                const endTime = Date.now();

                const duration = endTime - startTime;
                console.log(`Search for "${query}" (topK=10) took ${duration}ms, found ${results.length} results`);

                expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
                expect(results.length).toBeLessThanOrEqual(10);
            }
        });

        it('should perform fast searches with large result sets', async () => {
            const startTime = Date.now();
            const results = await connector.search(testAccessRequest, testNamespace, 'test vector', {
                topK: 100,
                threshold: 0.5,
            });
            const endTime = Date.now();

            const duration = endTime - startTime;
            console.log(`Search with topK=100 took ${duration}ms, found ${results.length} results`);

            expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
            expect(results.length).toBeLessThanOrEqual(100);
            expect(results.length).toBeGreaterThan(0);
        });

        it('should handle concurrent searches efficiently', async () => {
            const concurrentSearches = 10;
            const searchQueries = Array.from({ length: concurrentSearches }, (_, i) => 
                `concurrent search ${i} technology science arts`
            );

            const startTime = Date.now();
            
            const promises = searchQueries.map(query =>
                connector.search(testAccessRequest, testNamespace, query, {
                    topK: 20,
                    threshold: 0.6,
                })
            );

            const results = await Promise.all(promises);
            const endTime = Date.now();

            const duration = endTime - startTime;
            const searchesPerSecond = (concurrentSearches / duration) * 1000;
            
            console.log(`Concurrent ${concurrentSearches} searches took ${duration}ms (${searchesPerSecond.toFixed(2)} searches/sec)`);

            expect(results).toHaveLength(concurrentSearches);
            expect(results.every(result => Array.isArray(result))).toBe(true);
            expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
        });

        it('should maintain consistent search performance over time', async () => {
            const iterations = 5;
            const query = 'performance test vector';
            const durations: number[] = [];

            for (let i = 0; i < iterations; i++) {
                const startTime = Date.now();
                const results = await connector.search(testAccessRequest, testNamespace, query, {
                    topK: 50,
                    threshold: 0.6,
                });
                const endTime = Date.now();

                const duration = endTime - startTime;
                durations.push(duration);
                
                console.log(`Iteration ${i + 1}: Search took ${duration}ms, found ${results.length} results`);
                
                expect(results.length).toBeGreaterThan(0);
            }

            // Calculate performance statistics
            const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
            const maxDuration = Math.max(...durations);
            const minDuration = Math.min(...durations);
            const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
            const stdDev = Math.sqrt(variance);

            console.log(`Performance stats: avg=${avgDuration.toFixed(2)}ms, min=${minDuration}ms, max=${maxDuration}ms, stdDev=${stdDev.toFixed(2)}ms`);

            // Performance should be consistent (low variance)
            expect(stdDev).toBeLessThan(avgDuration * 0.5); // Standard deviation should be less than 50% of average
            expect(maxDuration).toBeLessThan(avgDuration * 2); // Max should not be more than 2x average
        });
    });

    describe('Namespace Management Performance', () => {
        it('should create and delete namespaces efficiently', async () => {
            const namespaceCount = 10;
            const namespaces: string[] = [];

            // Create multiple namespaces
            const createStartTime = Date.now();
            for (let i = 0; i < namespaceCount; i++) {
                const namespace = WeaviateTestUtils.generateTestNamespace(`perf-ns-${i}`);
                await connector.createNamespace(testAccessRequest, namespace);
                namespaces.push(namespace);
            }
            const createEndTime = Date.now();

            const createDuration = createEndTime - createStartTime;
            console.log(`Created ${namespaceCount} namespaces in ${createDuration}ms`);

            // Delete all namespaces
            const deleteStartTime = Date.now();
            for (const namespace of namespaces) {
                await connector.deleteNamespace(testAccessRequest, namespace);
            }
            const deleteEndTime = Date.now();

            const deleteDuration = deleteEndTime - deleteStartTime;
            console.log(`Deleted ${namespaceCount} namespaces in ${deleteDuration}ms`);

            expect(createDuration).toBeLessThan(namespaceCount * 1000); // Should be reasonable per namespace
            expect(deleteDuration).toBeLessThan(namespaceCount * 1000); // Should be reasonable per namespace
        });

        it('should check namespace existence efficiently', async () => {
            await connector.createNamespace(testAccessRequest, testNamespace);

            const checkCount = 100;
            const startTime = Date.now();
            
            for (let i = 0; i < checkCount; i++) {
                const exists = await connector.namespaceExists(testAccessRequest, testNamespace);
                expect(exists).toBe(true);
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            const checksPerSecond = (checkCount / duration) * 1000;
            
            console.log(`${checkCount} namespace existence checks took ${duration}ms (${checksPerSecond.toFixed(2)} checks/sec)`);

            expect(duration).toBeLessThan(checkCount * 10); // Should be very fast per check
        });
    });

    describe('Memory and Resource Usage', () => {
        it('should handle large datasets without memory issues', async () => {
            await connector.createNamespace(testAccessRequest, testNamespace);

            const largeDatasetSize = 1000;
            const largeVectors = Array.from({ length: largeDatasetSize }, (_, i) => ({
                id: `large-dataset-${i}`,
                text: `Large dataset vector ${i} with substantial content that includes multiple sentences and various keywords for comprehensive testing of memory usage and performance characteristics`,
                metadata: { 
                    index: i,
                    category: `Category${i % 10}`,
                    tags: Array.from({ length: 5 }, (_, j) => `tag${j}`),
                },
            }));

            const startTime = Date.now();
            const result = await connector.insert(testAccessRequest, testNamespace, largeVectors);
            const endTime = Date.now();

            const duration = endTime - startTime;
            const vectorsPerSecond = (largeDatasetSize / duration) * 1000;
            
            console.log(`Inserted ${largeDatasetSize} large vectors in ${duration}ms (${vectorsPerSecond.toFixed(2)} vectors/sec)`);

            expect(result).toHaveLength(largeDatasetSize);
            expect(duration).toBeLessThan(largeDatasetSize * 50); // Should be efficient even with large data

            // Verify we can still search efficiently
            const searchStartTime = Date.now();
            const searchResults = await connector.search(testAccessRequest, testNamespace, 'large dataset', {
                topK: 100,
            });
            const searchEndTime = Date.now();

            const searchDuration = searchEndTime - searchStartTime;
            console.log(`Search in large dataset took ${searchDuration}ms, found ${searchResults.length} results`);

            expect(searchDuration).toBeLessThan(5000); // Should still be fast
            expect(searchResults.length).toBeGreaterThan(0);
        });
    });

    describe('Stress Testing', () => {
        it('should handle stress test with mixed operations', async () => {
            await connector.createNamespace(testAccessRequest, testNamespace);

            const operationCount = 100;
            const startTime = Date.now();

            // Mix of insertions, searches, and deletions
            for (let i = 0; i < operationCount; i++) {
                if (i % 3 === 0) {
                    // Insert
                    const vector = WeaviateTestUtils.createTestVectorData(`stress-${i}`, `Stress test vector ${i}`);
                    await connector.insert(testAccessRequest, testNamespace, vector);
                } else if (i % 3 === 1) {
                    // Search
                    const results = await connector.search(testAccessRequest, testNamespace, `stress test ${i}`, {
                        topK: 5,
                    });
                    expect(Array.isArray(results)).toBe(true);
                } else {
                    // Delete (if vector exists)
                    try {
                        await connector.delete(testAccessRequest, testNamespace, `stress-${i - 2}`);
                    } catch (error) {
                        // Ignore deletion errors for non-existent vectors
                    }
                }
            }

            const endTime = Date.now();
            const duration = endTime - startTime;
            const operationsPerSecond = (operationCount / duration) * 1000;
            
            console.log(`Stress test with ${operationCount} mixed operations took ${duration}ms (${operationsPerSecond.toFixed(2)} ops/sec)`);

            expect(duration).toBeLessThan(operationCount * 100); // Should be efficient
        });
    });
});
