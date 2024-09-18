import { afterAll, describe, expect, it, vi } from 'vitest';
import config from '@sre/config';
import { ConnectorService, SmythRuntime } from '@sre/index';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { PineconeVectorDB } from '@sre/IO/VectorDB.service/connectors/PineconeVectorDB.class';
import { faker } from '@faker-js/faker';
import { Document } from '@langchain/core/documents';
import { VectorsHelper } from '@sre/IO/VectorDB.service/Vectors.helper';
import { IVectorDataSourceDto, SourceTypes } from '@sre/types/VectorDB.types';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { TConnectorService } from '@sre/types/SRE.types';

class CustomAccountConnector extends AccountConnector {
    public getCandidateTeam(candidate: IAccessCandidate): Promise<string | undefined> {
        if (candidate.id === 'agent-123456') {
            return Promise.resolve('9');
        } else if (candidate.id === 'agent-654321') {
            return Promise.resolve('5');
        }
        return super.getCandidateTeam(candidate);
    }
}
ConnectorService.register(TConnectorService.Account, 'MyCustomAccountConnector', CustomAccountConnector);

const SREInstance = SmythRuntime.Instance.init({
    Account: {
        Connector: 'MyCustomAccountConnector',
        Settings: {},
    },
    Cache: {
        Connector: 'Redis',
        Settings: {
            hosts: config.env.REDIS_SENTINEL_HOSTS,
            name: config.env.REDIS_MASTER_NAME || '',
            password: config.env.REDIS_PASSWORD || '',
        },
    },

    NKV: {
        Connector: 'Redis',
        Settings: {},
    },
    VectorDB: {
        Connector: 'Pinecone',
        Settings: {
            pineconeApiKey: config.env.PINECONE_API_KEY || '',
            openaiApiKey: config.env.OPENAI_API_KEY || '',
            indexName: config.env.PINECONE_INDEX_NAME || '',
        },
    },
});

const EVENTUAL_CONSISTENCY_DELAY = 4_000;

describe('Integration: Pinecone VectorDB', () => {
    describe('Functional', () => {
        const idsToClean: { id: string; namespace: string }[] = [];

        //* Cleanup
        afterAll(async () => {
            const vectorDB = ConnectorService.getVectorDBConnector('Pinecone');
            const team = AccessCandidate.team('team-123456');

            for (const id of idsToClean) {
                console.log('Cleaning up', id);
                await vectorDB
                    .user(team)
                    .delete(id.namespace, [id.id])
                    .catch((e) => {});

                await vectorDB
                    .user(team)
                    .deleteNamespace(id.namespace)
                    .catch((e) => {});
            }
        });

        it('insert as raw vectors', async () => {
            const dummyVectors: IVectorDataSourceDto[] = [
                {
                    id: '1',
                    source: Array.from({ length: 1536 }, () => Math.random()),
                    metadata: {
                        metafield: 'Hello World!',
                    },
                },
                {
                    id: '2',
                    source: Array.from({ length: 1536 }, () => Math.random()),
                    metadata: {
                        metafield: 'Hello World!',
                    },
                },
            ];

            const vectorDB = ConnectorService.getVectorDBConnector('Pinecone');
            const team = AccessCandidate.team('team-123456');

            const namespace = faker.lorem.slug();
            await vectorDB.user(team).createNamespace(namespace);
            idsToClean.push({ id: '1', namespace });
            idsToClean.push({ id: '2', namespace });
            await vectorDB.user(team).insert(namespace, dummyVectors);

            // search for the inserted vectors
            await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

            const searchResult = await vectorDB.user(team).search(namespace, dummyVectors[0].source, { topK: 10 });

            expect(searchResult).toHaveLength(2);

            expect(searchResult[0].id).toBe(dummyVectors[0].id);
        }, 60_000);

        it('insert vectors from text documents', async () => {
            const dummyDocuments: IVectorDataSourceDto[] = [
                {
                    id: '1',
                    source: 'Hello World!',
                    metadata: {},
                },
            ];

            const vectorDB = ConnectorService.getVectorDBConnector('Pinecone');
            const team = AccessCandidate.team('team-123456');

            const namespace = faker.lorem.slug();
            await vectorDB.user(team).createNamespace(namespace);
            idsToClean.push({ id: '1', namespace });
            await vectorDB.user(team).insert(namespace, dummyDocuments);

            // search for the inserted vectors
            await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

            const searchResult = await vectorDB.user(team).search(namespace, 'Hello World!', { topK: 10 });

            expect(searchResult).toHaveLength(1);

            expect(searchResult[0].id).toBe(dummyDocuments[0].id);
        }, 60_000);

        it('similiarty search by query', async () => {
            const vectorDB = ConnectorService.getVectorDBConnector('Pinecone') as PineconeVectorDB;
            const team = AccessCandidate.team('team-123456');

            // insert some dummy vectors to search

            const text = 'Best car in the world';

            const dummyVectors: IVectorDataSourceDto[] = [
                {
                    id: faker.string.uuid(),
                    source: await VectorsHelper.load().embedText(text),
                    metadata: {
                        text,
                    },
                },
                {
                    id: faker.string.uuid(),
                    source: await VectorsHelper.load().embedText(text),
                    metadata: {
                        text,
                    },
                },
            ];

            const namespace = faker.lorem.slug();
            await vectorDB.user(team).createNamespace(namespace);
            idsToClean.push({ id: dummyVectors[0].id, namespace });
            idsToClean.push({ id: dummyVectors[1].id, namespace });
            await vectorDB.user(team).insert(namespace, dummyVectors);

            await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

            const searchResult = await vectorDB.user(team).search(namespace, text, { topK: 10 });

            expect(searchResult).toHaveLength(2);

            // sort to make sure the order is consistent
            const sorted = searchResult.sort((a, b) => (a.id === dummyVectors[0].id ? -1 : 1));

            expect(sorted[0].id).toBe(dummyVectors[0].id);
            expect(sorted[1].id).toBe(dummyVectors[1].id);
        }, 60_000);

        it('similarity search by vector', async () => {
            const vectorDB = ConnectorService.getVectorDBConnector('Pinecone') as PineconeVectorDB;
            const team = AccessCandidate.team('team-123456');

            // insert some dummy vectors to search
            const dummyText = 'Best car in the world';
            const id = faker.string.uuid();
            const namespace = faker.string.uuid();
            await vectorDB.user(team).createNamespace(namespace);
            const v = await VectorsHelper.load().embedText(dummyText);

            await vectorDB.user(team).insert(namespace, [
                {
                    source: v,
                    id: id,
                },
            ]);

            idsToClean.push({ id, namespace });

            await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

            const searchResult = await vectorDB.user(team).search(namespace, v, { topK: 10 });
            expect(searchResult).toHaveLength(1);
            expect(searchResult[0].id).toBe(id);

            // delete the inserted vector
            await vectorDB.user(team).delete(namespace, [id]);
        }, 60_000);

        it('metadata should be returned with the search result', async () => {
            const vectorDB = ConnectorService.getVectorDBConnector('Pinecone') as PineconeVectorDB;
            const team = AccessCandidate.team('team-123456');

            // insert some dummy vectors to search
            const dummyText = 'Best car in the world';
            const id = faker.string.uuid();
            const namespace = faker.string.uuid();
            await vectorDB.user(team).createNamespace(namespace);

            const v = Array.from({ length: 1536 }, () => Math.random());

            await vectorDB.user(team).insert(namespace, [
                {
                    source: v,
                    id: id,
                    metadata: {
                        text: dummyText,
                        anotherField: 'another value',
                    },
                },
            ]);

            idsToClean.push({ id, namespace });

            await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

            const searchResult = await vectorDB.user(team).search(namespace, v, { topK: 10, includeMetadata: true });
            expect(searchResult).toHaveLength(1);
            expect(searchResult[0].id).toBe(id);
            expect(searchResult[0].metadata?.text).toBe(dummyText);
            expect(searchResult[0].metadata?.anotherField).toBe('another value');
        }, 60_000);

        it('delete vectors', async () => {
            const vectorDB = ConnectorService.getVectorDBConnector('Pinecone') as PineconeVectorDB;
            const team = AccessCandidate.team('team-123456');

            // insert some dummy vectors to search
            const dummyText = 'Best car in the world';
            const id = faker.string.uuid();
            const namespace = faker.string.uuid();
            await vectorDB.user(team).createNamespace(namespace);
            const v = await VectorsHelper.load().embedText(dummyText);

            await vectorDB.user(team).insert(namespace, [
                {
                    source: v,
                    id: id,
                    metadata: {
                        text: dummyText,
                    },
                },
            ]);

            idsToClean.push({ id, namespace });

            await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

            const searchResult = await vectorDB.user(team).search(namespace, v, { topK: 10 });
            expect(searchResult).toHaveLength(1);
            expect(searchResult[0].id).toBe(id);

            await vectorDB.user(team).delete(namespace, [id]);
        }, 60_000);

        it('different namespaces should not share vectors', async () => {
            const vectorDB = ConnectorService.getVectorDBConnector('Pinecone') as PineconeVectorDB;
            const team = AccessCandidate.team('team-123456');

            // insert some dummy vectors to search
            const v1 = Array.from({ length: 1536 }, () => Math.random());
            const v2 = Array.from({ length: 1536 }, () => Math.random());

            const namespace1 = faker.lorem.slug();
            const namespace2 = faker.lorem.slug();
            await vectorDB.user(team).createNamespace(namespace1);
            await vectorDB.user(team).createNamespace(namespace2);

            const id1 = faker.string.uuid();
            const id2 = faker.string.uuid();

            idsToClean.push({ id: id1, namespace: namespace1 });
            idsToClean.push({ id: id2, namespace: namespace2 });

            await vectorDB.user(team).insert(namespace1, [
                {
                    source: v1,
                    id: id1,
                    metadata: {
                        text: 'Best car in the world',
                    },
                },
            ]);
            await vectorDB.user(team).insert(namespace2, [
                {
                    source: v2,
                    id: id2,
                    metadata: {
                        text: 'Elephants gardens beatiful',
                    },
                },
            ]);

            await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

            const searchResultArr = await vectorDB.user(team).search(namespace1, v2, { topK: 10 });
            const result1Ids = searchResultArr.map((r) => r.id);
            // expect that the search result would not contain v2 id

            expect(result1Ids).not.toContain(id2);

            const searchResult2 = await vectorDB.user(team).search(namespace2, v1, { topK: 10 });
            const result2Ids = searchResult2.map((r) => r.id);
            // expect that the search result would not contain v1 id
            expect(result2Ids).not.toContain(id1);
        }, 60_000);

        it('delete namespace with all its vectors', async () => {
            const vectorDB = ConnectorService.getVectorDBConnector('Pinecone') as PineconeVectorDB;
            const team = AccessCandidate.team('team-123456');

            // insert some dummy vectors to search
            const dummyVectors: IVectorDataSourceDto[] = [
                {
                    id: faker.string.uuid(),
                    source: Array.from({ length: 1536 }, () => Math.random()),
                    metadata: {
                        metafield: 'Hello World!',
                    },
                },
                {
                    id: faker.string.uuid(),
                    source: Array.from({ length: 1536 }, () => Math.random()),
                    metadata: {
                        metafield: 'Hello World!',
                    },
                },
            ];

            const namespace = faker.lorem.slug();
            await vectorDB.user(team).createNamespace(namespace);
            idsToClean.push({ id: dummyVectors[0].id, namespace });
            idsToClean.push({ id: dummyVectors[1].id, namespace });

            await vectorDB.user(team).insert(namespace, dummyVectors);

            await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

            await vectorDB.user(team).deleteNamespace(namespace);
        }, 60_000);
    });

    describe('Security', () => {
        const ownerAgent = AccessCandidate.agent('agent-123456');
        // const ownerTeam = AccessCandidate.team('9');
        const strangerAgent = AccessCandidate.agent('agent-654321');

        it('should isolate namespaces with same names for different teams', async () => {
            const vectorDB = ConnectorService.getVectorDBConnector('Pinecone') as PineconeVectorDB;

            const namespace = faker.lorem.slug();
            await vectorDB.user(ownerAgent).createNamespace(namespace); // create namespace for the owner
            await vectorDB.user(strangerAgent).createNamespace(namespace); // create namespace for the stranger

            const v = Array.from({ length: 1536 }, () => Math.random());

            await vectorDB.user(ownerAgent).insert(namespace, [
                {
                    source: v,
                    id: faker.string.uuid(),
                    metadata: {
                        text: 'Best car in the world',
                    },
                },
            ]);

            await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

            // expect that the search result would contain the inserted vector for the owner
            const ownerSearchResult = await vectorDB.user(ownerAgent).search(namespace, v, { topK: 10 });
            expect(ownerSearchResult).toHaveLength(1);

            // expect that the search result would not contain the inserted vector for the stranger
            const strangerSearchResult = await vectorDB.user(strangerAgent).search(namespace, v, { topK: 10 });
            expect(strangerSearchResult).toHaveLength(0);
        }, 60_000);
    });
});
