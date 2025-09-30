import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { RAMVectorDB } from '@sre/IO/VectorDB.service/connectors/RAMVecrtorDB.class';

// Deterministic, offline embedding mock
// We mock the EmbeddingsFactory to return a local embedder with stable vectors
vi.mock('@sre/IO/VectorDB.service/embed', async () => {
    const base = await vi.importActual<any>('@sre/IO/VectorDB.service/embed/BaseEmbedding');

    function deterministicVector(text: string, dimensions: number): number[] {
        const dims = dimensions || 8;
        const vec = Array(dims).fill(0);
        for (let i = 0; i < (text || '').length; i++) {
            const code = text.charCodeAt(i);
            vec[code % dims] += (code % 13) + 1; // stable contribution per char
        }
        return vec;
    }

    class TestEmbeds extends base.BaseEmbedding {
        constructor(cfg?: any) {
            super(cfg);
            if (!this.dimensions) this.dimensions = 8;
        }
        async embedText(text: string): Promise<number[]> {
            return deterministicVector(text, this.dimensions as number);
        }
        async embedTexts(texts: string[]): Promise<number[][]> {
            return texts.map((t) => deterministicVector(t, this.dimensions as number));
        }
    }

    return {
        EmbeddingsFactory: {
            create: (_provider: any, config: any) => new TestEmbeds(config),
        },
    };
});

// Helper to mirror the deterministic embedding used in the mock
function makeVector(text: string, dimensions = 8): number[] {
    const vec = Array(dimensions).fill(0);
    for (let i = 0; i < (text || '').length; i++) {
        const code = text.charCodeAt(i);
        vec[code % dimensions] += (code % 13) + 1;
    }
    return vec;
}

// Initialize SRE with RAMVec and a small embedding dimension for faster tests
beforeAll(() => {
    setupSRE({
        VectorDB: {
            Connector: 'RAMVec',
            Settings: {
                embeddings: {
                    provider: 'OpenAI',
                    model: 'text-embedding-3-large',
                    params: { dimensions: 8 },
                },
            },
        },
        Log: { Connector: 'ConsoleLog' },
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('RAMVec - VectorDB connector (in-memory)', () => {
    describe('Core Functionality (Original Tests)', () => {
        it('should create, verify and delete a namespace; list only candidate namespaces', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const userA = AccessCandidate.user('test-user');
            const userB = AccessCandidate.user('other-user');

            const clientA = vdb.requester(userA);
            const clientB = vdb.requester(userB);

            // Namespace initially does not exist for either candidate (names are per-candidate)
            await expect(clientA.namespaceExists('Docs')).resolves.toBe(false);
            await expect(clientB.namespaceExists('Docs')).resolves.toBe(false);

            // Create namespace for userA
            await clientA.createNamespace('Docs', { project: 'alpha' });
            await expect(clientA.namespaceExists('Docs')).resolves.toBe(true);

            // userB still cannot see userA namespace (different prepared namespace)
            await expect(clientB.namespaceExists('Docs')).resolves.toBe(false);

            // No public listNamespaces API; verify per-candidate isolation via namespaceExists only
            await expect(clientA.namespaceExists('Docs')).resolves.toBe(true);
            await expect(clientB.namespaceExists('Docs')).resolves.toBe(false);

            // Delete A namespace
            await clientA.deleteNamespace('Docs');
            await expect(clientA.namespaceExists('Docs')).resolves.toBe(false);
        });

        it('should create datasource with chunking and search by string and vector', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('test-user');
            const client = vdb.requester(user);

            // Prepare namespace and datasource
            await client.createNamespace('docs');

            const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // length 26
            // chunkSize 10 with overlap 2 => expected chunks: [0..9], [8..17], [16..25] => 3 chunks
            const ds = await client.createDatasource('docs', {
                id: 'ds1',
                label: 'Alphabet',
                text,
                chunkSize: 10,
                chunkOverlap: 2,
                metadata: { source: 'unit-test' },
            });

            expect(ds.id).toBe('ds1');
            expect(ds.vectorIds.length).toBe(3);
            expect(ds.metadata).toBeDefined();

            // get/list datasources
            const fetched = await client.getDatasource('docs', 'ds1');
            expect(fetched.id).toBe('ds1');
            const list = await client.listDatasources('docs');
            expect(list.map((d) => d.id)).toContain('ds1');

            // Search by string; expect the chunk containing 'KLM' (in second chunk) to surface
            const byString = await client.search('docs', 'KLM', { topK: 3, includeMetadata: true });
            expect(byString.length).toBeGreaterThan(0);
            expect(byString[0].text.includes('KLM')).toBe(true);
            expect(byString[0].metadata).toBeDefined();
            expect(byString[0].values.length).toBe(8); // our mocked dimension

            // Search by vector using the same deterministic embedding
            const queryVec = makeVector('KLM', 8);
            const byVector = await client.search('docs', queryVec, { topK: 1, includeMetadata: false });
            expect(byVector.length).toBe(1);
            expect(byVector[0].text.includes('KLM')).toBe(true);
            expect(byVector[0].metadata).toBeUndefined(); // includeMetadata: false
        });

        it('should honor topK and includeMetadata options and return results sorted by similarity', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('test-user');
            const client = vdb.requester(user);

            await client.createNamespace('lib');

            // Two datasources to provide more chunks
            await client.createDatasource('lib', {
                id: 'dsA',
                label: 'DS A',
                text: 'hello world hello again hello once more',
                chunkSize: 11,
                chunkOverlap: 3,
            });
            await client.createDatasource('lib', {
                id: 'dsB',
                label: 'DS B',
                text: 'different topic altogether with no hellos',
                chunkSize: 12,
                chunkOverlap: 2,
            });

            const q = 'hello again';

            const top1 = await client.search('lib', q, { topK: 1, includeMetadata: false });
            expect(top1.length).toBe(1);
            expect(top1[0].metadata).toBeUndefined();

            const top3 = await client.search('lib', q, { topK: 3, includeMetadata: true });
            expect(top3.length).toBeLessThanOrEqual(3);
            // ensure scores are non-increasing (sorted desc)
            for (let i = 1; i < top3.length; i++) {
                expect((top3[i - 1].score || 0) >= (top3[i].score || 0)).toBe(true);
                expect(top3[i].metadata).toBeDefined();
            }
        });

        it('should delete datasource and make it unavailable', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('test-user');
            const client = vdb.requester(user);

            await client.createNamespace('workspace');
            await client.createDatasource('workspace', { id: 'dsX', label: 'X', text: 'SOME TEXT FOR DSX', chunkSize: 8, chunkOverlap: 2 });
            await client.createDatasource('workspace', { id: 'dsY', label: 'Y', text: 'OTHER TEXT FOR DSY', chunkSize: 8, chunkOverlap: 2 });

            let list = await client.listDatasources('workspace');
            expect(list.map((d) => d.id).sort()).toEqual(['dsX', 'dsY']);

            // Delete dsX
            await client.deleteDatasource('workspace', 'dsX');

            list = await client.listDatasources('workspace');
            expect(list.map((d) => d.id)).not.toContain('dsX');
            // getDatasource for deleted should return undefined
            const deletedDs = await client.getDatasource('workspace', 'dsX');
            expect(deletedDs).toBeUndefined();
        });

        it('should throw when searching non-existing namespace and after deleting namespace', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('test-user');
            const client = vdb.requester(user);

            // Non-existing namespace
            await expect(client.search('ghost', 'anything')).rejects.toThrow('Namespace does not exist');

            // Create and then delete
            await client.createNamespace('temp');
            await client.createDatasource('temp', { id: 'tempDS', label: 'temp', text: 'short text', chunkSize: 10, chunkOverlap: 0 });
            await client.deleteNamespace('temp');

            await expect(client.search('temp', 'short')).rejects.toThrow('Namespace does not exist');
            // listing datasources should be empty (no throw)
            const list = await client.listDatasources('temp');
            expect(list).toEqual([]);
        });

        it('should get namespace metadata and handle non-existing namespace', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('test-user');

            // Test getNamespace - this is an internal method, so we access it directly
            const ramVectorDB = vdb as any;

            // Should throw for non-existing namespace
            await expect(ramVectorDB.getNamespace(user.readRequest, 'non-existing')).rejects.toThrow('Namespace non-existing not found');

            // Create namespace with metadata
            await vdb.requester(user).createNamespace('project-alpha', {
                project: 'alpha',
                description: 'Test project namespace',
                version: '1.0.0',
            });

            // Should return namespace data
            const nsData = await ramVectorDB.getNamespace(user.readRequest, 'project-alpha');
            expect(nsData).toBeDefined();
            expect(nsData.displayName).toBe('project-alpha');
            expect(nsData.candidateId).toBe('test-user');
            expect(nsData.candidateRole).toBe('user');
            expect(nsData.metadata).toBeDefined();
            expect(nsData.metadata.project).toBe('alpha');
            expect(nsData.metadata.description).toBe('Test project namespace');
            expect(nsData.metadata.version).toBe('1.0.0');
            expect(nsData.metadata.storageType).toBe('RAM');
            expect(nsData.namespace).toContain('test-user');
            expect(nsData.namespace).toContain('project-alpha');
        });

        it('should handle deleteDatasource edge cases', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('test-user');
            const client = vdb.requester(user);

            await client.createNamespace('edge-cases');

            // Should return undefined for non-existing datasource (graceful handling)
            const nonExistingDs = await client.getDatasource('edge-cases', 'non-existing-ds');
            expect(nonExistingDs).toBeUndefined();

            // Should throw when trying to delete non-existing datasource
            await expect(client.deleteDatasource('edge-cases', 'non-existing-ds')).rejects.toThrow('Data source not found with id: non-existing-ds');

            // Create a datasource and verify it exists
            await client.createDatasource('edge-cases', {
                id: 'test-ds',
                label: 'Test Datasource',
                text: 'This is a test datasource with some content for testing deletion',
                chunkSize: 15,
                chunkOverlap: 3,
                metadata: { type: 'test', category: 'edge-case' },
            });

            // Verify datasource exists
            const ds = await client.getDatasource('edge-cases', 'test-ds');
            expect(ds.id).toBe('test-ds');
            expect(ds.vectorIds.length).toBeGreaterThan(0);

            // Verify vectors exist in search
            const searchBefore = await client.search('edge-cases', 'test datasource', { topK: 5 });
            expect(searchBefore.length).toBeGreaterThan(0);

            // Delete the datasource
            await client.deleteDatasource('edge-cases', 'test-ds');

            // Verify datasource no longer exists
            const deletedDs = await client.getDatasource('edge-cases', 'test-ds');
            expect(deletedDs).toBeUndefined();

            // Verify datasource is not in list
            const list = await client.listDatasources('edge-cases');
            expect(list.map((d) => d.id)).not.toContain('test-ds');

            // Verify vectors are removed from search (should return fewer or no results)
            const searchAfter = await client.search('edge-cases', 'test datasource', { topK: 5 });
            expect(searchAfter.length).toBeLessThan(searchBefore.length);

            // Should throw when trying to delete the same datasource again
            await expect(client.deleteDatasource('edge-cases', 'test-ds')).rejects.toThrow('Data source not found with id: test-ds');
        });
    });

    describe('Error Handling & Edge Cases', () => {
        it('should handle empty and null inputs gracefully', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('test-user');
            const client = vdb.requester(user);

            await client.createNamespace('edge-test');

            // Test empty strings
            await expect(
                client.createDatasource('edge-test', {
                    id: 'empty-text',
                    label: 'Empty Text Test',
                    text: '',
                    chunkSize: 10,
                    chunkOverlap: 2,
                })
            ).rejects.toThrow();

            // Test search with empty query
            await expect(client.search('edge-test', '')).resolves.toEqual([]);

            // Test invalid chunk sizes
            await expect(
                client.createDatasource('edge-test', {
                    id: 'invalid-chunk',
                    label: 'Invalid Chunk',
                    text: 'Some text',
                    chunkSize: 0,
                    chunkOverlap: 2,
                })
            ).rejects.toThrow();

            await expect(
                client.createDatasource('edge-test', {
                    id: 'negative-chunk',
                    label: 'Negative Chunk',
                    text: 'Some text',
                    chunkSize: -5,
                    chunkOverlap: 2,
                })
            ).rejects.toThrow();
        });

        it('should handle mismatched vector dimensions', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('test-user');
            const client = vdb.requester(user);

            await client.createNamespace('dimension-test');
            await client.createDatasource('dimension-test', {
                id: 'test-ds',
                label: 'Test',
                text: 'Test text for dimension mismatch',
                chunkSize: 10,
                chunkOverlap: 0,
            });

            // Test search with wrong dimension vector (our mock uses 8 dimensions)
            const wrongDimensionVector = Array(16).fill(0.5); // 16 dimensions instead of 8
            await expect(client.search('dimension-test', wrongDimensionVector)).rejects.toThrow();
        });

        it('should handle malformed metadata gracefully', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('test-user');
            const client = vdb.requester(user);

            await client.createNamespace('metadata-test');

            // Test with circular reference in metadata (should not crash)
            const circularRef: any = { name: 'test' };
            circularRef.self = circularRef;

            // This should throw an error due to circular reference in JSON serialization
            await expect(
                client.createDatasource('metadata-test', {
                    id: 'circular-meta',
                    label: 'Circular Metadata',
                    text: 'Test text with circular metadata',
                    chunkSize: 10,
                    chunkOverlap: 0,
                    metadata: circularRef,
                })
            ).rejects.toThrow('Converting circular structure');
        });

        it('should handle concurrent namespace operations', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('concurrent-user');
            const client = vdb.requester(user);

            // Attempt concurrent namespace creation
            const promises = Array.from({ length: 5 }, (_, i) => client.createNamespace(`concurrent-ns-${i}`, { index: i }));

            await Promise.all(promises);

            // Verify all namespaces were created
            for (let i = 0; i < 5; i++) {
                await expect(client.namespaceExists(`concurrent-ns-${i}`)).resolves.toBe(true);
            }

            // Concurrent deletion
            const deletePromises = Array.from({ length: 5 }, (_, i) => client.deleteNamespace(`concurrent-ns-${i}`));

            await Promise.all(deletePromises);

            // Verify all namespaces were deleted
            for (let i = 0; i < 5; i++) {
                await expect(client.namespaceExists(`concurrent-ns-${i}`)).resolves.toBe(false);
            }
        });
    });

    describe('Vector Operations & Similarity Testing', () => {
        it('should calculate cosine similarity correctly with known vectors', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec') as RAMVectorDB;
            const user = AccessCandidate.user('similarity-user');
            const client = vdb.requester(user);

            await client.createNamespace('similarity-test');

            // Create datasources with specific text that should produce known similarity patterns
            await client.createDatasource('similarity-test', {
                id: 'identical-1',
                label: 'Identical Text 1',
                text: 'apple banana cherry',
                chunkSize: 20,
                chunkOverlap: 0,
            });

            await client.createDatasource('similarity-test', {
                id: 'identical-2',
                label: 'Identical Text 2',
                text: 'apple banana cherry',
                chunkSize: 20,
                chunkOverlap: 0,
            });

            await client.createDatasource('similarity-test', {
                id: 'different',
                label: 'Different Text',
                text: 'zebra yoga xray',
                chunkSize: 20,
                chunkOverlap: 0,
            });

            // Search with identical text should return highest similarity for identical content
            const results = await client.search('similarity-test', 'apple banana cherry', { topK: 5 });

            expect(results.length).toBeGreaterThan(0);

            // First two results should be from identical datasources with same/similar scores
            expect(results[0].score).toBeGreaterThan(0.9); // High similarity for identical text
            if (results.length > 1) {
                expect(Math.abs((results[0].score || 0) - (results[1].score || 0))).toBeLessThan(0.1);
            }
        });

        it('should handle zero vectors without crashing', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('zero-vector-user');
            const client = vdb.requester(user);

            await client.createNamespace('zero-vector-test');

            // Create a datasource first
            await client.createDatasource('zero-vector-test', {
                id: 'normal-ds',
                label: 'Normal Datasource',
                text: 'This is normal text content',
                chunkSize: 10,
                chunkOverlap: 0,
            });

            // Test search with zero vector
            const zeroVector = Array(8).fill(0);
            const results = await client.search('zero-vector-test', zeroVector, { topK: 1 });

            // Should not crash and should return results (even if similarity is 0)
            expect(Array.isArray(results)).toBe(true);
            expect(results[0].score).toBeDefined();
        });

        it('should maintain vector similarity ordering', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('ordering-user');
            const client = vdb.requester(user);

            await client.createNamespace('ordering-test');

            // Create multiple datasources with varying similarity to query
            const textsWithExpectedOrder = [
                'machine learning artificial intelligence', // Most similar to query
                'machine learning data science', // Medium similarity
                'artificial intelligence robots', // Medium-low similarity
                'completely unrelated content here', // Least similar
            ];

            for (let i = 0; i < textsWithExpectedOrder.length; i++) {
                await client.createDatasource('ordering-test', {
                    id: `ds-${i}`,
                    label: `Dataset ${i}`,
                    text: textsWithExpectedOrder[i],
                    chunkSize: 50,
                    chunkOverlap: 0,
                });
            }

            const results = await client.search('ordering-test', 'machine learning AI', { topK: 10 });

            // Verify results are sorted by similarity (descending)
            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].score || 0).toBeGreaterThanOrEqual(results[i].score || 0);
            }

            // The most similar content should be ranked highest
            expect(results[0].text).toContain('machine learning');
        });

        it('should handle high-dimensional vectors correctly', async () => {
            // Test with our 8-dimensional mock (could be extended for real high-dimensional testing)
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('high-dim-user');
            const client = vdb.requester(user);

            await client.createNamespace('high-dim-test');

            await client.createDatasource('high-dim-test', {
                id: 'high-dim-ds',
                label: 'High Dimensional Test',
                text: 'Content for high dimensional vector testing with various terms and concepts',
                chunkSize: 20,
                chunkOverlap: 5,
            });

            // Test with complex query
            const results = await client.search('high-dim-test', 'dimensional vector testing concepts', { topK: 3 });

            expect(results.length).toBeGreaterThan(0);
            expect(results[0].values.length).toBe(8); // Our mock dimension
            expect(results[0].score).toBeGreaterThan(0);
        });
    });

    describe('Security & Access Control', () => {
        it('should prevent cross-tenant data leakage comprehensively', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const userA = AccessCandidate.user('tenant-a');
            const userB = AccessCandidate.user('tenant-b');
            const userC = AccessCandidate.user('tenant-c');

            const clientA = vdb.requester(userA);
            const clientB = vdb.requester(userB);
            const clientC = vdb.requester(userC);

            // Create identical namespace names for different users
            await clientA.createNamespace('shared-name', { tenant: 'a', secret: 'a-secret' });
            await clientB.createNamespace('shared-name', { tenant: 'b', secret: 'b-secret' });

            // Create datasources with sensitive information
            await clientA.createDatasource('shared-name', {
                id: 'sensitive-a',
                label: 'Sensitive A',
                text: 'Confidential information for tenant A: password123',
                chunkSize: 20,
                chunkOverlap: 0,
                metadata: { classification: 'confidential-a' },
            });

            await clientB.createDatasource('shared-name', {
                id: 'sensitive-b',
                label: 'Sensitive B',
                text: 'Secret data for tenant B: secret456',
                chunkSize: 20,
                chunkOverlap: 0,
                metadata: { classification: 'confidential-b' },
            });

            // Verify complete isolation
            const resultsA = await clientA.search('shared-name', 'password123', { topK: 10, includeMetadata: true });
            const resultsB = await clientB.search('shared-name', 'secret456', { topK: 10, includeMetadata: true });

            // User A should only see their own data
            expect(resultsA.length).toBeGreaterThan(0);
            expect(resultsA[0].text).toContain('password123');
            expect(resultsA[0].metadata?.classification).toBe('confidential-a');

            // User B should only see their own data
            expect(resultsB.length).toBeGreaterThan(0);
            expect(resultsB[0].text).toContain('secret456');
            expect(resultsB[0].metadata?.classification).toBe('confidential-b');

            // Cross-tenant searches should find nothing
            const crossSearchA = await clientA.search('shared-name', 'secret456', { topK: 10 });
            const crossSearchB = await clientB.search('shared-name', 'password123', { topK: 10 });

            expect(crossSearchA.every((r) => !r.text.includes('secret456'))).toBe(true);
            expect(crossSearchB.every((r) => !r.text.includes('password123'))).toBe(true);

            // User C shouldn't see the namespace at all
            await expect(clientC.namespaceExists('shared-name')).resolves.toBe(false);
            await expect(clientC.search('shared-name', 'anything')).rejects.toThrow('Namespace does not exist');
        });

        it('should validate ACL permissions correctly', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec') as RAMVectorDB;
            const owner = AccessCandidate.user('resource-owner');
            const stranger = AccessCandidate.user('stranger-user');

            // Owner creates resource
            const ownerClient = vdb.requester(owner);
            await ownerClient.createNamespace('acl-test', { owner: 'resource-owner' });

            // Test ACL retrieval
            const acl = await vdb.getResourceACL('acl-test', owner);
            expect(acl).toBeDefined();

            // Owner should have access
            const ownerAccess = acl.checkExactAccess(owner.ownerRequest);
            expect(ownerAccess).toBe(true);

            // Stranger should not have automatic access to owner's namespace
            const strangerClient = vdb.requester(stranger);
            await expect(strangerClient.namespaceExists('acl-test')).resolves.toBe(false);
        });

        it('should handle malicious input attempts', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('security-test-user');
            const client = vdb.requester(user);

            await client.createNamespace('security-test');

            // Test SQL injection-like attempts in namespace names
            await expect(client.createNamespace("'; DROP TABLE vectors; --")).resolves.not.toThrow();

            // Test XSS-like attempts in metadata
            const xssMetadata = {
                description: '<script>alert("xss")</script>',
                name: '"><script>alert("xss")</script>',
            };

            await expect(
                client.createDatasource('security-test', {
                    id: 'xss-test',
                    label: 'XSS Test',
                    text: 'Normal text content',
                    chunkSize: 10,
                    chunkOverlap: 0,
                    metadata: xssMetadata,
                })
            ).resolves.toBeTruthy();

            // Verify metadata is properly escaped/handled
            const ds = await client.getDatasource('security-test', 'xss-test');
            expect(ds).toBeDefined();
        });
    });

    describe('Data Consistency & Integrity', () => {
        it('should handle update operations correctly', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('update-user');
            const client = vdb.requester(user);

            await client.createNamespace('update-test');

            // Create initial datasource
            const ds1 = await client.createDatasource('update-test', {
                id: 'updateable-ds',
                label: 'Original Label',
                text: 'Original text content here',
                chunkSize: 10,
                chunkOverlap: 2,
                metadata: { version: '1' },
            });

            const initialVectorCount = ds1.vectorIds.length;

            // Update with different content
            const ds2 = await client.createDatasource('update-test', {
                id: 'updateable-ds', // Same ID
                label: 'Updated Label',
                text: 'Completely different updated text content with more words',
                chunkSize: 8,
                chunkOverlap: 1,
                metadata: { version: '2' },
            });

            // Verify update occurred
            expect(ds2.name).toBe('Updated Label');
            expect(ds2.text).toContain('updated text content');

            // Vector count may differ due to different chunking
            expect(ds2.vectorIds.length).not.toBe(initialVectorCount);

            // Verify content has been updated by checking datasource content directly
            const updatedDs = await client.getDatasource('update-test', 'updateable-ds');
            expect(updatedDs.text).toContain('updated text content');
            expect(updatedDs.text).not.toContain('Original text content');

            // Verify that the updated datasource has different vector IDs (indicating new vectors were created)
            expect(updatedDs.vectorIds).not.toEqual(ds1.vectorIds);

            // Verify search returns some results (the important thing is that it doesn't crash)
            const searchResults = await client.search('update-test', 'text', { topK: 5 });
            expect(searchResults.length).toBeGreaterThan(0);
        });

        it('should maintain data integrity during concurrent operations', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('concurrent-ops-user');
            const client = vdb.requester(user);

            await client.createNamespace('concurrent-ops');

            // Perform multiple concurrent datasource operations
            const createPromises = Array.from({ length: 10 }, (_, i) =>
                client.createDatasource('concurrent-ops', {
                    id: `concurrent-ds-${i}`,
                    label: `Concurrent DS ${i}`,
                    text: `Content for datasource number ${i} with unique identifier ${i}`,
                    chunkSize: 15,
                    chunkOverlap: 3,
                    metadata: { index: i.toString(), batch: 'concurrent' },
                })
            );

            const results = await Promise.all(createPromises);

            // Verify all datasources were created
            expect(results.length).toBe(10);
            results.forEach((ds, i) => {
                expect(ds.id).toBe(`concurrent-ds-${i}`);
                expect(ds.vectorIds.length).toBeGreaterThan(0);
            });

            // Verify data integrity via listing
            const allDatasources = await client.listDatasources('concurrent-ops');
            expect(allDatasources.length).toBe(10);

            // Concurrent deletion
            const deletePromises = Array.from({ length: 5 }, (_, i) => client.deleteDatasource('concurrent-ops', `concurrent-ds-${i}`));

            await Promise.all(deletePromises);

            // Verify partial deletion
            const remainingDatasources = await client.listDatasources('concurrent-ops');
            expect(remainingDatasources.length).toBe(5);

            const remainingIds = remainingDatasources.map((ds) => ds.id);
            for (let i = 0; i < 5; i++) {
                expect(remainingIds).not.toContain(`concurrent-ds-${i}`);
            }
            for (let i = 5; i < 10; i++) {
                expect(remainingIds).toContain(`concurrent-ds-${i}`);
            }
        });

        it('should handle transaction rollback scenarios', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('rollback-user');
            const client = vdb.requester(user);

            await client.createNamespace('rollback-test');

            // Create initial valid datasource
            await client.createDatasource('rollback-test', {
                id: 'valid-ds',
                label: 'Valid Datasource',
                text: 'This is valid content',
                chunkSize: 10,
                chunkOverlap: 0,
            });

            const initialCount = (await client.listDatasources('rollback-test')).length;

            // Attempt to create datasource with invalid parameters (should fail)
            try {
                await client.createDatasource('rollback-test', {
                    id: 'invalid-ds',
                    label: 'Invalid Datasource',
                    text: '', // Empty text should fail
                    chunkSize: 10,
                    chunkOverlap: 0,
                });
            } catch (error) {
                // Expected to fail
            }

            // Verify no partial state was left behind
            const finalCount = (await client.listDatasources('rollback-test')).length;
            expect(finalCount).toBe(initialCount);

            const datasources = await client.listDatasources('rollback-test');
            expect(datasources.every((ds) => ds.id !== 'invalid-ds')).toBe(true);
        });
    });

    describe('Performance & Stress Testing', () => {
        it('should handle large datasets efficiently', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('performance-user');
            const client = vdb.requester(user);

            await client.createNamespace('performance-test');

            // Create large text content
            const largeText = Array.from(
                { length: 1000 },
                (_, i) => `This is sentence number ${i} containing various words and concepts for testing performance with large datasets.`
            ).join(' ');

            const start = performance.now();

            // Create datasource with large content
            const ds = await client.createDatasource('performance-test', {
                id: 'large-ds',
                label: 'Large Dataset',
                text: largeText,
                chunkSize: 100,
                chunkOverlap: 10,
            });

            const createTime = performance.now() - start;

            // Should complete in reasonable time (adjust threshold as needed)
            expect(createTime).toBeLessThan(5000); // 5 seconds max
            expect(ds.vectorIds.length).toBeGreaterThan(50); // Should create many chunks

            // Test search performance
            const searchStart = performance.now();
            const results = await client.search('performance-test', 'sentence number concepts', { topK: 10 });
            const searchTime = performance.now() - searchStart;

            expect(searchTime).toBeLessThan(1000); // 1 second max for search
            expect(results.length).toBeGreaterThan(0);
        });

        it('should handle multiple concurrent users', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const userCount = 5;
            const users = Array.from({ length: userCount }, (_, i) => AccessCandidate.user(`concurrent-user-${i}`));

            const start = performance.now();

            // Each user creates their own namespace and datasource
            const userOperations = users.map(async (user, i) => {
                const client = vdb.requester(user);
                await client.createNamespace(`user-${i}-ns`);

                return client.createDatasource(`user-${i}-ns`, {
                    id: `user-${i}-ds`,
                    label: `User ${i} Dataset`,
                    text: `Content for user ${i} with unique data and information specific to user ${i}`,
                    chunkSize: 20,
                    chunkOverlap: 5,
                });
            });

            const results = await Promise.all(userOperations);
            const totalTime = performance.now() - start;

            // All operations should complete successfully
            expect(results.length).toBe(userCount);
            results.forEach((ds, i) => {
                expect(ds.id).toBe(`user-${i}-ds`);
            });

            // Should handle concurrent load efficiently
            expect(totalTime).toBeLessThan(3000); // 3 seconds max for all concurrent ops

            // Verify isolation - each user can only see their own data
            for (let i = 0; i < userCount; i++) {
                const client = vdb.requester(users[i]);
                const searchResults = await client.search(`user-${i}-ns`, `user ${i}`, { topK: 5 });

                expect(searchResults.length).toBeGreaterThan(0);
                expect(searchResults[0].text).toContain(`user ${i}`);
            }
        });

        it('should efficiently handle memory with many operations', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('memory-test-user');
            const client = vdb.requester(user);

            await client.createNamespace('memory-test');

            // Measure memory usage pattern
            const initialMemory = process.memoryUsage();

            // Create, search, and delete many datasources
            for (let batch = 0; batch < 3; batch++) {
                // Create batch of datasources
                const createPromises = Array.from({ length: 10 }, (_, i) =>
                    client.createDatasource('memory-test', {
                        id: `batch-${batch}-ds-${i}`,
                        label: `Batch ${batch} DS ${i}`,
                        text: `Content for batch ${batch} datasource ${i} with various text`,
                        chunkSize: 15,
                        chunkOverlap: 3,
                    })
                );

                await Promise.all(createPromises);

                // Perform searches
                const searchPromises = Array.from({ length: 10 }, (_, i) => client.search('memory-test', `batch ${batch} content`, { topK: 5 }));

                await Promise.all(searchPromises);

                // Delete batch
                const deletePromises = Array.from({ length: 10 }, (_, i) => client.deleteDatasource('memory-test', `batch-${batch}-ds-${i}`));

                await Promise.all(deletePromises);
            }

            const finalMemory = process.memoryUsage();

            // Memory growth should be reasonable (adjust threshold as needed)
            const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
            expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB growth

            // Verify cleanup
            const remainingDatasources = await client.listDatasources('memory-test');
            expect(remainingDatasources.length).toBe(0);
        });
    });

    describe('Configuration & Provider Testing', () => {
        it('should handle embedding configuration edge cases', async () => {
            // This test works with our mocked embedding provider
            const vdb = ConnectorService.getVectorDBConnector('RAMVec') as RAMVectorDB;

            // Verify embedder configuration
            expect(vdb.embedder).toBeDefined();
            expect(vdb.embedder.dimensions).toBe(8); // Our mock configuration

            const user = AccessCandidate.user('config-test-user');
            const client = vdb.requester(user);

            await client.createNamespace('config-test');

            // Test with various text lengths
            const testTexts = [
                'a', // Single character
                'short text', // Short text
                'This is a longer text that should be handled properly by the embedding system regardless of length and complexity.',
                'Special characters: !@#$%^&*()_+-=[]{}|;:,.<>?',
                '数字和Unicode字符', // Unicode characters
            ];

            for (const text of testTexts) {
                await expect(
                    client.createDatasource('config-test', {
                        id: `config-test-${testTexts.indexOf(text)}`,
                        label: `Config Test ${testTexts.indexOf(text)}`,
                        text,
                        chunkSize: 10,
                        chunkOverlap: 0,
                    })
                ).resolves.toBeTruthy();
            }

            // Verify all datasources were created successfully
            const datasources = await client.listDatasources('config-test');
            expect(datasources.length).toBe(testTexts.length);
        });

        it('should handle chunking configuration variations', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('chunking-test-user');
            const client = vdb.requester(user);

            await client.createNamespace('chunking-test');

            const baseText = 'The quick brown fox jumps over the lazy dog. This is a test sentence for chunking.';

            // Test various chunking configurations
            const chunkConfigs = [
                { chunkSize: 10, chunkOverlap: 0 }, // No overlap
                { chunkSize: 15, chunkOverlap: 5 }, // Small overlap
                { chunkSize: 20, chunkOverlap: 10 }, // Large overlap
                { chunkSize: 100, chunkOverlap: 0 }, // Large chunk, no overlap
                { chunkSize: 5, chunkOverlap: 2 }, // Very small chunks
            ];

            for (let i = 0; i < chunkConfigs.length; i++) {
                const config = chunkConfigs[i];
                const ds = await client.createDatasource('chunking-test', {
                    id: `chunk-config-${i}`,
                    label: `Chunk Config ${i}`,
                    text: baseText,
                    chunkSize: config.chunkSize,
                    chunkOverlap: config.chunkOverlap,
                });

                expect(ds.vectorIds.length).toBeGreaterThan(0);

                // Verify chunking produced expected number of chunks
                const expectedChunks = Math.ceil((baseText.length - config.chunkOverlap) / (config.chunkSize - config.chunkOverlap));
                expect(ds.vectorIds.length).toBeLessThanOrEqual(expectedChunks + 2); // Allow some variance
            }
        });
    });

    describe('Memory Management & Cleanup', () => {
        it('should properly clean up after namespace deletion', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec') as RAMVectorDB;
            const user = AccessCandidate.user('cleanup-test-user');
            const client = vdb.requester(user);

            await client.createNamespace('cleanup-test');

            // Create multiple datasources
            for (let i = 0; i < 5; i++) {
                await client.createDatasource('cleanup-test', {
                    id: `cleanup-ds-${i}`,
                    label: `Cleanup DS ${i}`,
                    text: `Content for cleanup datasource ${i}`,
                    chunkSize: 10,
                    chunkOverlap: 0,
                });
            }

            // Verify datasources exist
            const datasources = await client.listDatasources('cleanup-test');
            expect(datasources.length).toBe(5);

            // Verify vectors exist via search
            const searchResults = await client.search('cleanup-test', 'content', { topK: 10 });
            expect(searchResults.length).toBeGreaterThan(0);

            // Delete namespace
            await client.deleteNamespace('cleanup-test');

            // Verify complete cleanup
            await expect(client.namespaceExists('cleanup-test')).resolves.toBe(false);
            await expect(client.search('cleanup-test', 'content')).rejects.toThrow('Namespace does not exist');

            // Verify orphaned data is cleaned up
            const emptyList = await client.listDatasources('cleanup-test');
            expect(emptyList).toEqual([]);
        });

        it('should handle resource limits gracefully', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('limits-test-user');
            const client = vdb.requester(user);

            await client.createNamespace('limits-test');

            // Test with very large single datasource
            const veryLargeText = Array.from(
                { length: 10000 },
                (_, i) => `Sentence ${i} with content for testing resource limits and memory management.`
            ).join(' ');

            const start = performance.now();

            const largeDs = await client.createDatasource('limits-test', {
                id: 'very-large-ds',
                label: 'Very Large Dataset',
                text: veryLargeText,
                chunkSize: 50,
                chunkOverlap: 10,
            });

            const creationTime = performance.now() - start;

            // Should handle large content without excessive delay
            expect(creationTime).toBeLessThan(10000); // 10 seconds max
            expect(largeDs.vectorIds.length).toBeGreaterThan(100);

            // Verify search still works efficiently
            const searchStart = performance.now();
            const results = await client.search('limits-test', 'sentence content testing', { topK: 5 });
            const searchTime = performance.now() - searchStart;

            expect(searchTime).toBeLessThan(2000); // 2 seconds max
            expect(results.length).toBeGreaterThan(0);

            // Cleanup should also be efficient
            const deleteStart = performance.now();
            await client.deleteDatasource('limits-test', 'very-large-ds');
            const deleteTime = performance.now() - deleteStart;

            expect(deleteTime).toBeLessThan(15000); // 15 seconds max for very large dataset
        });

        it('should prevent memory leaks with repeated operations', async () => {
            const vdb = ConnectorService.getVectorDBConnector('RAMVec');
            const user = AccessCandidate.user('leak-test-user');
            const client = vdb.requester(user);

            await client.createNamespace('leak-test');

            const initialMemory = process.memoryUsage();

            // Perform many create/delete cycles
            for (let cycle = 0; cycle < 10; cycle++) {
                // Create datasource
                await client.createDatasource('leak-test', {
                    id: `cycle-${cycle}`,
                    label: `Cycle ${cycle}`,
                    text: `Content for cycle ${cycle} with repeated operations testing`,
                    chunkSize: 20,
                    chunkOverlap: 5,
                });

                // Search multiple times
                for (let search = 0; search < 5; search++) {
                    await client.search('leak-test', `cycle ${cycle}`, { topK: 3 });
                }

                // Delete datasource
                await client.deleteDatasource('leak-test', `cycle-${cycle}`);
            }

            const finalMemory = process.memoryUsage();
            const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

            // Memory growth should be minimal for repeated operations
            expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth

            // Verify no datasources remain
            const remainingDatasources = await client.listDatasources('leak-test');
            expect(remainingDatasources.length).toBe(0);
        });
    });
});
