import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

// Deterministic, offline embedding mock
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

// Pinecone SDK mock with in-memory store
vi.mock('@pinecone-database/pinecone', () => {
    type Item = { id: string; values: number[]; metadata?: any };
    const store = new Map<string, Item[]>(); // key: namespace

    const ensureNs = (ns: string) => {
        if (!store.has(ns)) store.set(ns, []);
        return store.get(ns)!;
    };

    const cosine = (a: number[], b: number[]) => {
        if (!a || !b || a.length !== b.length) return 0;
        let dot = 0,
            na = 0,
            nb = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        const denom = Math.sqrt(na) * Math.sqrt(nb);
        return denom === 0 ? 0 : dot / denom;
    };

    class PineconeIndexNS {
        constructor(private ns: string) {}
        async upsert(items: Item[]) {
            const arr = ensureNs(this.ns);
            for (const it of items) {
                const i = arr.findIndex((x) => x.id === it.id);
                if (i >= 0) arr[i] = it;
                else arr.push(it);
            }
        }
        async query({ vector, topK, includeValues = true, includeMetadata = true }: any) {
            const arr = ensureNs(this.ns);
            const matches = arr
                .map((it) => ({
                    id: it.id,
                    values: includeValues ? it.values : undefined,
                    metadata: includeMetadata ? it.metadata : undefined,
                    score: cosine(vector, it.values),
                }))
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .slice(0, topK);
            return { matches };
        }
        async deleteMany(ids: string[]) {
            const arr = ensureNs(this.ns);
            for (const id of ids) {
                const i = arr.findIndex((x) => x.id === id);
                if (i >= 0) arr.splice(i, 1);
            }
        }
        async deleteAll() {
            // Remove the namespace entirely so describeIndexStats no longer lists it
            store.delete(this.ns);
        }
    }

    class PineconeIndex {
        constructor(private indexName: string) {}
        namespace(ns: string) {
            return new PineconeIndexNS(ns);
        }
        async describeIndexStats() {
            const namespaces: Record<string, any> = {};
            for (const ns of store.keys()) namespaces[ns] = {};
            return { namespaces };
        }
    }

    class Pinecone {
        constructor(_: any) {}
        Index(indexName: string) {
            return new PineconeIndex(indexName);
        }
    }

    return { Pinecone };
});

function makeVector(text: string, dimensions = 8): number[] {
    const vec = Array(dimensions).fill(0);
    for (let i = 0; i < (text || '').length; i++) {
        const code = text.charCodeAt(i);
        vec[code % dimensions] += (code % 13) + 1;
    }
    return vec;
}

beforeAll(() => {
    setupSRE({
        // Use RAM NKV to keep unit tests fully in-memory
        NKV: { Connector: 'RAM' },
        VectorDB: {
            Connector: 'Pinecone',
            Settings: {
                apiKey: 'test-api-key',
                indexName: 'test-index',
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

describe('Pinecone - VectorDB connector (unit, mocked SDK)', () => {
    it('should create namespace and reflect in describeIndexStats / namespaceExists', async () => {
        const vdb = ConnectorService.getVectorDBConnector('Pinecone');
        const user = AccessCandidate.user('unit-user');
        const client = vdb.requester(user);

        await client.createNamespace('docs', { env: 'test' });
        await expect(client.namespaceExists('docs')).resolves.toBe(true);
    });

    it('should create/list/get/delete datasource and persist metadata in NKV', async () => {
        const vdb = ConnectorService.getVectorDBConnector('Pinecone');
        const user = AccessCandidate.user('meta-user');
        const client = vdb.requester(user);

        await client.createNamespace('docs');
        const ds = await client.createDatasource('docs', {
            id: 'pc-ds1',
            label: 'PC DS1',
            text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            chunkSize: 10,
            chunkOverlap: 2,
            metadata: { provider: 'pinecone', tag: 'x' },
        });
        expect(ds.id).toBe('pc-ds1');
        expect(ds.vectorIds.length).toBeGreaterThan(0);

        const got = await client.getDatasource('docs', 'pc-ds1');
        expect(got.id).toBe('pc-ds1');
        const list = await client.listDatasources('docs');
        expect(list.map((d) => d.id)).toContain('pc-ds1');

        await client.deleteDatasource('docs', 'pc-ds1');
        const after = await client.getDatasource('docs', 'pc-ds1');
        expect(after).toBeUndefined();
    });

    it('should search by string and by vector; filter out skeleton vector and sort by score', async () => {
        const vdb = ConnectorService.getVectorDBConnector('Pinecone');
        const user = AccessCandidate.user('search-user');
        const client = vdb.requester(user);

        await client.createNamespace('lib');
        await client.createDatasource('lib', {
            id: 'dsA',
            label: 'A',
            text: 'hello world hello again hello once more',
            chunkSize: 11,
            chunkOverlap: 3,
        });
        await client.createDatasource('lib', {
            id: 'dsB',
            label: 'B',
            text: 'different topic altogether with no hellos',
            chunkSize: 12,
            chunkOverlap: 2,
        });

        const q = 'hello again';
        const top1 = await client.search('lib', q, { topK: 1, includeMetadata: true });
        expect(top1.length).toBe(1);
        const top3 = await client.search('lib', q, { topK: 3, includeMetadata: true });
        for (let i = 1; i < top3.length; i++) {
            expect((top3[i - 1].score || 0) >= (top3[i].score || 0)).toBe(true);
        }

        const qv = makeVector('hello');
        const vecRes = await client.search('lib', qv, { topK: 2 });
        expect(vecRes.length).toBeGreaterThan(0);
    });

    it('should delete namespace and clear vectors', async () => {
        const vdb = ConnectorService.getVectorDBConnector('Pinecone');
        const user = AccessCandidate.user('del-user');
        const client = vdb.requester(user);

        await client.createNamespace('tmp');
        await client.createDatasource('tmp', {
            id: 'one',
            label: 'One',
            text: 'some content here',
            chunkSize: 8,
            chunkOverlap: 2,
        });
        await expect(client.namespaceExists('tmp')).resolves.toBe(true);
        await client.deleteNamespace('tmp');
        await expect(client.namespaceExists('tmp')).resolves.toBe(false);
    });

    it('insert should reject mixed source types and URL sources', async () => {
        const vdb = ConnectorService.getVectorDBConnector('Pinecone') as any;
        const user = AccessCandidate.user('insert-user');
        await vdb.requester(user).createNamespace('mix');

        await expect(
            vdb.insert(user.writeRequest, 'mix', [
                { id: 't', source: 'text', metadata: { datasourceId: 'd' } },
                { id: 'v', source: Array(8).fill(0), metadata: { datasourceId: 'd' } },
            ])
        ).rejects.toThrow('All sources must be of the same type');

        await expect(
            vdb.insert(user.writeRequest, 'mix', [{ id: 'u', source: 'https://example.com', metadata: { datasourceId: 'd' } }])
        ).rejects.toThrow('Invalid source type');
    });
});
