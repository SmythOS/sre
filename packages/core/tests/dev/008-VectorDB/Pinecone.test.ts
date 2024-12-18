import { afterAll, describe, expect, it, vi } from 'vitest';
import config from '@sre/config';
import { ConnectorService, SmythRuntime } from '@sre/index';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { PineconeVectorDB } from '@sre/IO/VectorDB.service/connectors/PineconeVectorDB.class';
import { faker } from '@faker-js/faker';
import crypto from 'crypto';
import { VectorsHelper } from '@sre/IO/VectorDB.service/Vectors.helper';
//ConnectorService.register(TConnectorService.Account, 'MyCustomAccountConnector', TestAccountConnector);

const SREInstance = SmythRuntime.Instance.init({
    Account: {
        Connector: 'DummyAccount',
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

            const promise = new Promise(async (resolve, reject) => {
                let timeout: NodeJS.Timeout;

                timeout = setTimeout(() => {
                    reject(new Error('Cleanup Timeout'));
                }, 10_000);

                for (const id of idsToClean) {
                    console.log('Cleaning up', id);
                    // await vectorDB
                    //     .user(team)
                    //     .delete(id.namespace, [id.id])
                    //     .catch((e) => {});

                    await vectorDB
                        .user(team)
                        .deleteNamespace(id.namespace)
                        .catch((e) => {});
                }

                if (timeout) {
                    clearTimeout(timeout);
                }
                resolve(true);
            });

            await promise.catch((e) => {
                console.log('Cleanup failed', e);
            });
        });

        describe('Namespaces', () => {
            it('create namespace', async () => {
                const vectorDB = ConnectorService.getVectorDBConnector('Pinecone');
                const team = AccessCandidate.team('team-123456');

                await vectorDB.user(team).createNamespace(faker.lorem.slug());
            });

            it("list namespaces should return the created namespace's name", async () => {
                const team = AccessCandidate.team('team-123456');
                const vectorDB = ConnectorService.getVectorDBConnector('Pinecone');

                const namespaceSlugs = [faker.lorem.slug(), faker.lorem.slug(), faker.lorem.slug()];
                const promises = namespaceSlugs.map((ns) => vectorDB.user(team).createNamespace(ns));
                await Promise.all(promises);

                const namespaces = (await vectorDB.user(team).listNamespaces()).map((n) => n.displayName);
                expect(namespaces.length).toBeGreaterThanOrEqual(namespaceSlugs.length);
                expect(namespaces).toEqual(expect.arrayContaining(namespaceSlugs));

                const promises2 = namespaceSlugs.map((ns) => vectorDB.user(team).deleteNamespace(ns));
                await Promise.all(promises2);
            }, 60_000);
        });

        describe('Datasources', () => {
            it('insert datasource (large text)', async () => {
                const hugeText = faker.lorem.paragraphs(30);
                const namespace = faker.lorem.slug();
                const team = AccessCandidate.team('team-123');
                const vectorDB = ConnectorService.getVectorDBConnector('Pinecone');

                await vectorDB.user(team).createNamespace(namespace);
                await vectorDB.user(team).createDatasource(namespace, {
                    text: hugeText,
                });

                const expectedVectorsSize = (await VectorsHelper.chunkText(hugeText)).length;

                await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

                const results = await ConnectorService.getVectorDBConnector()
                    .user(team)
                    .search(
                        namespace,
                        Array.from({ length: 1536 }, () => Math.random()),
                        { topK: expectedVectorsSize }
                    );

                expect(results).toHaveLength(expectedVectorsSize);
            });

            it('lists datasources', async () => {
                const namespace = faker.lorem.slug();
                const team = AccessCandidate.team('team-123');
                const vectorDB = ConnectorService.getVectorDBConnector('Pinecone');

                await vectorDB.user(team).createNamespace(namespace);

                const hugeText = faker.lorem.paragraphs(30);
                await vectorDB.user(team).createDatasource(namespace, {
                    text: hugeText,
                });

                const datasources = await vectorDB.user(team).listDatasources(namespace);

                expect(datasources).toHaveLength(1);
            }, 60_000);

            it('deletes datasource', async () => {
                const namespace = faker.lorem.slug();
                const team = AccessCandidate.team('team-123');
                const vectorDB = ConnectorService.getVectorDBConnector('Pinecone');

                await vectorDB.user(team).createNamespace(namespace);

                const hugeText = faker.lorem.paragraphs(30);
                const id = crypto.randomUUID();
                await vectorDB.user(team).createDatasource(namespace, { text: hugeText, id, metadata: { label: 'test' } });

                const dsBeforeDelete = await vectorDB.user(team).getDatasource(namespace, id);
                expect(dsBeforeDelete).toBeDefined();

                await vectorDB.user(team).deleteDatasource(namespace, id);

                const dsAfterDelete = await vectorDB.user(team).getDatasource(namespace, id);
                expect(dsAfterDelete).toBeUndefined();
            });
        });

        describe('Search', () => {
            it('similiarty search by query', async () => {
                const vectorDB = ConnectorService.getVectorDBConnector('Pinecone') as PineconeVectorDB;
                const team = AccessCandidate.team('team-123456');

                // insert some dummy vectors to search

                const dummySources = [
                    {
                        text: 'Best car in the world',
                        id: faker.string.uuid(),
                        metadata: {
                            text: 'Best car in the world',
                        },
                    },
                    {
                        text: 'Best car in the world',
                        id: faker.string.uuid(),
                        metadata: {
                            text: 'Best car in the world',
                        },
                    },
                ];

                const namespace = faker.lorem.slug();
                await vectorDB.user(team).createNamespace(namespace);
                // idsToClean.push({ id: dummyVectors[0].id, namespace });
                // idsToClean.push({ id: dummyVectors[1].id, namespace });
                let v1Id: string, v2Id: string;
                const promises = dummySources.map(async (ds) => vectorDB.user(team).createDatasource(namespace, ds));
                const results = await Promise.all(promises);
                v1Id = results[0].vectorIds[0];
                v2Id = results[1].vectorIds[0];

                await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

                const searchResult = await vectorDB.user(team).search(namespace, dummySources[0].text, { topK: 10 });

                expect(searchResult).toHaveLength(2);

                // sort to make sure the order is consistent
                const sorted = searchResult.sort((a, b) => (a.id === v1Id ? -1 : 1));

                expect(sorted[0].id).toBe(v1Id);
                expect(sorted[1].id).toBe(v2Id);
            }, 60_000);

            it('similarity search by vector', async () => {
                const vectorDB = ConnectorService.getVectorDBConnector('Pinecone') as PineconeVectorDB;
                const team = AccessCandidate.team('team-123456');

                // insert some dummy vectors to search
                const dummyText = 'Best car in the world';
                const dsId = faker.string.uuid();
                const namespace = faker.string.uuid();
                await vectorDB.user(team).createNamespace(namespace);
                const v = await VectorsHelper.load().embedText(dummyText);

                const dsResponse = await vectorDB.user(team).createDatasource(namespace, {
                    text: dummyText,
                    id: dsId,
                });

                idsToClean.push({ id: dsId, namespace });

                await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

                const searchResult = await vectorDB.user(team).search(namespace, v, { topK: 10 });
                expect(searchResult).toHaveLength(1);
                expect(searchResult[0].id).toBe(dsResponse.vectorIds[0]);

                // delete the inserted vector
                await vectorDB.user(team).deleteDatasource(namespace, dsId);
            }, 60_000);

            it('metadata should be returned with the search result', async () => {
                const vectorDB = ConnectorService.getVectorDBConnector('Pinecone') as PineconeVectorDB;
                const team = AccessCandidate.team('team-123456');

                // insert some dummy vectors to search
                const dummyText = 'Best car in the world';
                const dsId = faker.string.uuid();
                const namespace = faker.string.uuid();
                await vectorDB.user(team).createNamespace(namespace);

                const v = Array.from({ length: 1536 }, () => Math.random());

                const dsResponse = await vectorDB.user(team).createDatasource(namespace, {
                    text: dummyText,
                    id: dsId,
                    metadata: {
                        text: dummyText,
                        anotherField: 'another value',
                    },
                });

                idsToClean.push({ id: dsId, namespace });

                await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

                const searchResult = await vectorDB.user(team).search(namespace, v, { topK: 10, includeMetadata: true });
                expect(searchResult).toHaveLength(1);
                expect(searchResult[0].id).toBe(dsResponse.vectorIds[0]);
                expect(searchResult[0].metadata?.user?.text).toBe(dummyText);
                expect(searchResult[0].metadata?.user?.anotherField).toBe('another value');
            }, 60_000);
        });
    });

    describe('Security', () => {
        const ownerAgent = AccessCandidate.agent('agent-123456');
        // const ownerTeam = AccessCandidate.team('9');
        const strangerTeam = AccessCandidate.team('team-654321');

        it('should isolate namespaces with same names for different teams', async () => {
            const vectorDB = ConnectorService.getVectorDBConnector('Pinecone') as PineconeVectorDB;

            const namespace = faker.lorem.slug();
            await vectorDB.user(ownerAgent).createNamespace(namespace); // create namespace for the owner
            await vectorDB.user(strangerTeam).createNamespace(namespace); // create namespace for the stranger

            const text = 'Best car in the world';
            const id = faker.string.uuid();

            await vectorDB.user(ownerAgent).createDatasource(namespace, {
                text,
                id,
                metadata: {
                    text: 'Best car in the world',
                },
            });

            await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

            // expect that the search result would contain the inserted vector for the owner
            const ownerSearchResult = await vectorDB.user(ownerAgent).search(namespace, text, { topK: 10 });
            expect(ownerSearchResult).toHaveLength(1);

            // expect that the search result would not contain the inserted vector for the stranger
            const strangerSearchResult = await vectorDB.user(strangerTeam).search(namespace, text, { topK: 10 });
            expect(strangerSearchResult).toHaveLength(0);
        }, 60_000);

        it('different namespaces should not share vectors', async () => {
            const vectorDB = ConnectorService.getVectorDBConnector('Pinecone') as PineconeVectorDB;
            const team = AccessCandidate.team('team-123456');

            // insert some dummy vectors to search
            const v1 = 'Best car in the world';
            const v2 = 'Elephants gardens beatiful';

            const namespace1 = faker.lorem.slug();
            const namespace2 = faker.lorem.slug();
            await vectorDB.user(team).createNamespace(namespace1);
            await vectorDB.user(team).createNamespace(namespace2);

            const id1 = faker.string.uuid();
            const id2 = faker.string.uuid();

            // idsToClean.push({ id: id1, namespace: namespace1 });
            // idsToClean.push({ id: id2, namespace: namespace2 });

            await vectorDB.user(team).createDatasource(namespace1, {
                text: v1,
                id: id1,
                metadata: {
                    text: v1,
                },
            });
            await vectorDB.user(team).createDatasource(namespace2, {
                text: v2,
                id: id2,
                metadata: {
                    text: v2,
                },
            });

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
    });
});
