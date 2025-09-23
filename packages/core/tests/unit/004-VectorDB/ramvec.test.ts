import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

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
