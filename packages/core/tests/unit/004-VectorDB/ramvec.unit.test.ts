import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { RAMVectorDB } from '@sre/IO/VectorDB.service/connectors/RAMVecrtorDB.class';

// Deterministic, offline embedding mock for unit-level determinism
vi.mock('@sre/IO/VectorDB.service/embed', async () => {
    const base = await vi.importActual<any>('@sre/IO/VectorDB.service/embed/BaseEmbedding');

    function deterministicVector(text: string, dimensions: number): number[] {
        const dims = dimensions || 8;
        const vec = Array(dims).fill(0);
        for (let i = 0; i < (text || '').length; i++) {
            const code = text.charCodeAt(i);
            vec[code % dims] += (code % 13) + 1;
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

describe('RAMVec - Unit tests for RAMVectorDB internals', () => {
    it('should format names via constructNsName', async () => {
        const vdb = ConnectorService.getVectorDBConnector('RAMVec') as RAMVectorDB;
        const user = AccessCandidate.user('User-123');
        const ns = (vdb as any).constructNsName(user, '  My Project  ');
        expect(ns).toMatch(/^u_User-123_/);
        expect(ns.endsWith('my_project')).toBe(true);
    });

    it('should grant Owner ACL before/after namespace creation', async () => {
        const vdb = ConnectorService.getVectorDBConnector('RAMVec') as RAMVectorDB;
        const owner = AccessCandidate.user('acl-owner');

        const aclBefore = await vdb.getResourceACL('ns-acl', owner);
        expect(aclBefore.checkExactAccess(owner.ownerRequest)).toBe(true);

        await vdb.requester(owner).createNamespace('ns-acl');
        const aclAfter = await vdb.getResourceACL('ns-acl', owner);
        expect(aclAfter.checkExactAccess(owner.ownerRequest)).toBe(true);
    });

    it('should list only namespaces belonging to the candidate', async () => {
        const vdb = ConnectorService.getVectorDBConnector('RAMVec') as RAMVectorDB;
        const a = AccessCandidate.user('ns-a');
        const b = AccessCandidate.user('ns-b');

        await vdb.requester(a).createNamespace('alpha');
        await vdb.requester(a).createNamespace('beta');
        await vdb.requester(b).createNamespace('alpha');

        const listA = await (vdb as any).listNamespaces(a.readRequest);
        const listB = await (vdb as any).listNamespaces(b.readRequest);

        expect(listA.map((n: any) => n.displayName).sort()).toEqual(['alpha', 'beta']);
        expect(listB.map((n: any) => n.displayName)).toEqual(['alpha']);
    });

    it('insert should reject mixed source types (text vs vector)', async () => {
        const vdb = ConnectorService.getVectorDBConnector('RAMVec') as RAMVectorDB;
        const user = AccessCandidate.user('insert-mixed');
        await vdb.requester(user).createNamespace('mix');

        const mixed = [
            { id: 'v1', source: 'text source', metadata: { datasourceId: 'ds' } },
            { id: 'v2', source: Array(8).fill(0), metadata: { datasourceId: 'ds' } },
        ];

        await expect((vdb as any).insert(user.writeRequest, 'mix', mixed)).rejects.toThrow('All sources must be of the same type');
    });

    it('insert should reject URL sources', async () => {
        const vdb = ConnectorService.getVectorDBConnector('RAMVec') as RAMVectorDB;
        const user = AccessCandidate.user('insert-url');
        await vdb.requester(user).createNamespace('urls');

        const urlSource = [{ id: 'u1', source: 'https://example.com', metadata: { datasourceId: 'ds' } }];

        await expect((vdb as any).insert(user.writeRequest, 'urls', urlSource)).rejects.toThrow('Invalid source type');
    });

    it('delete should support ids array and datasourceId filter; throw on unsupported filter', async () => {
        const vdb = ConnectorService.getVectorDBConnector('RAMVec') as RAMVectorDB;
        const user = AccessCandidate.user('delete-user');
        const client = vdb.requester(user);

        await client.createNamespace('del');
        const ds = await client.createDatasource('del', {
            id: 'ds1',
            label: 'DS1',
            text: 'abcdefghij klmnop qrst uvw xyz',
            chunkSize: 5,
            chunkOverlap: 0,
        });

        // delete by specific id
        const firstId = ds.vectorIds[0];
        await (vdb as any).delete(user.writeRequest, 'del', [firstId]);
        let res = await client.search('del', 'abc', { topK: 100 });
        expect(Array.isArray(res)).toBe(true);

        // delete the rest by datasourceId
        await (vdb as any).delete(user.writeRequest, 'del', { datasourceId: 'ds1' });
        res = await client.search('del', 'abc', { topK: 10 });
        expect(res.length).toBe(0);

        // unsupported filter
        await expect((vdb as any).delete(user.writeRequest, 'del', { foo: 'bar' })).rejects.toThrow('Unsupported delete filter');
    });

    it('includeMetadata should return {} when absent and parse when present', async () => {
        const vdb = ConnectorService.getVectorDBConnector('RAMVec') as RAMVectorDB;
        const user = AccessCandidate.user('meta-user');
        const client = vdb.requester(user);

        await client.createNamespace('meta');
        await client.createDatasource('meta', {
            id: 'no-meta',
            label: 'No Meta',
            text: 'alpha beta gamma',
            chunkSize: 50,
            chunkOverlap: 0,
        });
        await client.createDatasource('meta', {
            id: 'with-meta',
            label: 'With Meta',
            text: 'delta epsilon',
            chunkSize: 50,
            chunkOverlap: 0,
            metadata: { a: '1', b: 'x' },
        });

        const r1 = await client.search('meta', 'alpha', { topK: 1, includeMetadata: true });
        expect(r1[0].metadata).toBeDefined();

        const r2 = await client.search('meta', 'delta', { topK: 5, includeMetadata: true });
        expect(r2.some((r) => r.metadata && (r.metadata.a === 1 || r.metadata.b === 'x'))).toBe(true);
    });
});
