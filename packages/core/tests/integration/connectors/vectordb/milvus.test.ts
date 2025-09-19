import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupSRE } from '../../../utils/sre';
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

function makeVector(text: string, dimensions = 8): number[] {
    const vec = Array(dimensions).fill(0);
    for (let i = 0; i < (text || '').length; i++) {
        const code = text.charCodeAt(i);
        vec[code % dimensions] += (code % 13) + 1;
    }
    return vec;
}

const MILVUS_ADDRESS = process.env.MILVUS_ADDRESS as string; // e.g. localhost:19530
const MILVUS_TOKEN = process.env.MILVUS_TOKEN as string | undefined;
const MILVUS_USER = process.env.MILVUS_USER as string | undefined;
const MILVUS_PASSWORD = process.env.MILVUS_PASSWORD as string | undefined;
const MILVUS_DIMENSIONS = Number(process.env.MILVUS_DIMENSIONS || 1024);

beforeAll(() => {
    const credentials = MILVUS_TOKEN
        ? { address: MILVUS_ADDRESS, token: MILVUS_TOKEN }
        : { address: MILVUS_ADDRESS, user: MILVUS_USER, password: MILVUS_PASSWORD };

    setupSRE({
        VectorDB: {
            Connector: 'Milvus',
            Settings: {
                credentials,
                embeddings: {
                    provider: 'OpenAI',
                    model: 'text-embedding-3-large',
                    params: { dimensions: MILVUS_DIMENSIONS },
                },
            },
        },
        Log: { Connector: 'ConsoleLog' },
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('Milvus - VectorDB connector', () => {
    it('should create namespace, add/list/get/delete datasource, search by string/vector', async () => {
        const vdb = ConnectorService.getVectorDBConnector('Milvus');
        const user = AccessCandidate.user('test-user');
        const client = vdb.requester(user);

        // Create namespace and verify
        await client.createNamespace('docs', { env: 'test' });
        await expect(client.namespaceExists('docs')).resolves.toBe(true);

        // Create datasource with chunking
        const ds = await client.createDatasource('docs', {
            id: 'mv-ds1',
            label: 'MV DS1',
            text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            chunkSize: 10,
            chunkOverlap: 2,
            metadata: { provider: 'milvus' },
        });
        expect(ds.id).toBe('mv-ds1');
        expect(ds.vectorIds.length).toBeGreaterThan(0);

        // get/list datasource metadata
        const got = await client.getDatasource('docs', 'mv-ds1');
        expect(got?.id).toBe('mv-ds1');
        const list = await client.listDatasources('docs');
        expect(list.map((d) => d.id)).toContain('mv-ds1');

        // Search by string
        const resText = await client.search('docs', 'KLM', { topK: 3, includeMetadata: true });
        expect(resText.length).toBeGreaterThan(0);

        // Search by vector
        const qv = makeVector('KLM', MILVUS_DIMENSIONS);
        const resVec = await client.search('docs', qv, { topK: 1 });
        expect(resVec.length).toBe(1);

        // topK behavior and sorting
        const top1 = await client.search('docs', 'ALPHA', { topK: 1 });
        expect(top1.length).toBe(1);
        const top3 = await client.search('docs', 'ALPHA', { topK: 3 });
        for (let i = 1; i < top3.length; i++) {
            expect((top3[i - 1].score || 0) >= (top3[i].score || 0)).toBe(true);
        }

        // Delete datasource and verify
        await client.deleteDatasource('docs', 'mv-ds1');
        const maybeDeleted = await client.getDatasource('docs', 'mv-ds1');
        expect(maybeDeleted).toBeUndefined();

        // Delete namespace
        await client.deleteNamespace('docs');
        await expect(client.namespaceExists('docs')).resolves.toBe(false);
    }, 60000);
});
