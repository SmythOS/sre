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

// Milvus SDK mock (in-memory)
vi.mock('@zilliz/milvus2-sdk-node', () => {
    type RecordType = {
        id: string;
        text?: string;
        user_metadata?: string;
        namespaceId?: string;
        datasourceId?: string;
        datasourceLabel?: string;
        vector: number[];
        score?: number;
    };

    const collections = new Map<string, RecordType[]>();

    const ensure = (name: string) => {
        if (!collections.has(name)) collections.set(name, []);
        return collections.get(name)!;
    };

    const ErrorCode = { SUCCESS: 0 } as const;
    const DataType = { VarChar: 0, FloatVector: 1 } as const;

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

    class MilvusClient {
        constructor(_: any) {}
        async createCollection({ collection_name }: any) {
            ensure(collection_name);
            return { status: { error_code: ErrorCode.SUCCESS } };
        }
        async hasCollection({ collection_name }: any) {
            return { status: { error_code: ErrorCode.SUCCESS }, value: collections.has(collection_name) };
        }
        async dropCollection({ collection_name }: any) {
            collections.delete(collection_name);
            return { error_code: ErrorCode.SUCCESS };
        }
        async insert({ collection_name, data }: { collection_name: string; data: RecordType[] }) {
            const arr = ensure(collection_name);
            for (const r of data) arr.push({ ...r });
            return { status: { error_code: ErrorCode.SUCCESS } };
        }
        async deleteEntities({ collection_name, expr }: any) {
            const arr = ensure(collection_name);
            // expr format: datasourceId == "<id>"
            const m = /datasourceId\s*==\s*"([^"]+)"/.exec(expr || '');
            const dsId = m?.[1];
            if (dsId) {
                for (let i = arr.length - 1; i >= 0; i--) if (arr[i].datasourceId === dsId) arr.splice(i, 1);
            }
            return { status: { error_code: ErrorCode.SUCCESS } };
        }
        async delete({ collection_name, ids }: any) {
            const arr = ensure(collection_name);
            for (let i = arr.length - 1; i >= 0; i--) if (ids.includes(arr[i].id)) arr.splice(i, 1);
            return { status: { error_code: ErrorCode.SUCCESS } };
        }
        async search({ vector, collection_name, limit }: any) {
            const arr = ensure(collection_name);
            const results = arr
                .map((r) => ({ ...r, score: cosine(vector, r.vector) }))
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .slice(0, limit)
                .map((r) => ({
                    id: r.id,
                    text: r.text,
                    ['user_metadata']: r.user_metadata,
                    vector: r.vector,
                    score: r.score,
                }));
            return { results } as any;
        }
        async *queryIterator({ collection_name, batchSize }: any) {
            const arr = [...ensure(collection_name)];
            let i = 0;
            while (i < arr.length) {
                const batch = arr.slice(i, i + batchSize);
                i += batchSize;
                yield batch.map((r) => ({
                    id: r.id,
                    text: r.text,
                    ['user_metadata']: r.user_metadata,
                    namespaceId: r.namespaceId,
                    datasourceId: r.datasourceId,
                    datasourceLabel: r.datasourceLabel,
                    vector: r.vector,
                }));
            }
        }
        async query({ collection_name, expr }: any) {
            const arr = ensure(collection_name);
            const m = /datasourceId\s*==\s*"([^"]+)"/.exec(expr || '');
            const dsId = m?.[1];
            const data = arr
                .filter((r) => (dsId ? r.datasourceId === dsId : true))
                .map((r) => ({
                    id: r.id,
                    text: r.text,
                    ['user_metadata']: r.user_metadata,
                    namespaceId: r.namespaceId,
                    datasourceId: r.datasourceId,
                    datasourceLabel: r.datasourceLabel,
                    vector: r.vector,
                }));
            return { data } as any;
        }
    }

    return { MilvusClient, ErrorCode, DataType };
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
        VectorDB: {
            Connector: 'Milvus',
            Settings: {
                credentials: { address: 'localhost:19530', token: 'test' },
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

describe('Milvus - VectorDB connector (unit, mocked SDK)', () => {
    it('should create namespace and reflect in hasCollection / namespaceExists', async () => {
        const vdb = ConnectorService.getVectorDBConnector('Milvus');
        const user = AccessCandidate.user('milvus-user');
        const client = vdb.requester(user);

        await client.createNamespace('docs');
        await expect(client.namespaceExists('docs')).resolves.toBe(true);
    });

    it('should create/list/get/delete datasource and update records', async () => {
        const vdb = ConnectorService.getVectorDBConnector('Milvus');
        const user = AccessCandidate.user('meta-user');
        const client = vdb.requester(user);

        await client.createNamespace('docs');
        const ds = await client.createDatasource('docs', {
            id: 'mv-ds1',
            label: 'MV DS1',
            text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            chunkSize: 10,
            chunkOverlap: 2,
            metadata: { provider: 'milvus', tag: 'x' },
        });
        expect(ds.id).toBe('mv-ds1');
        expect(ds.vectorIds.length).toBeGreaterThan(0);

        const got = await client.getDatasource('docs', 'mv-ds1');
        expect(got?.id).toBe('mv-ds1');

        const list = await client.listDatasources('docs');
        expect(list.map((d) => d.id)).toContain('mv-ds1');

        await client.deleteDatasource('docs', 'mv-ds1');
        const after = await client.getDatasource('docs', 'mv-ds1');
        expect(after).toBeUndefined();
    });

    it('should search by string and by vector; sort by score', async () => {
        const vdb = ConnectorService.getVectorDBConnector('Milvus');
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
        const top1 = await client.search('lib', q, { topK: 1 });
        expect(top1.length).toBe(1);
        const top3 = await client.search('lib', q, { topK: 3 });
        for (let i = 1; i < top3.length; i++) {
            expect((top3[i - 1].score || 0) >= (top3[i].score || 0)).toBe(true);
        }

        const qv = makeVector('hello');
        const vecRes = await client.search('lib', qv, { topK: 2 });
        expect(vecRes.length).toBeGreaterThan(0);
    });

    it('should delete namespace and clear records', async () => {
        const vdb = ConnectorService.getVectorDBConnector('Milvus');
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
        const vdb = ConnectorService.getVectorDBConnector('Milvus') as any;
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
        ).rejects.toThrow('Unsupported source type');
    });
});
