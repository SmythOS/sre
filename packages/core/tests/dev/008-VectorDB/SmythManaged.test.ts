import { afterAll, describe, expect, it, vi } from 'vitest';
import config from '@sre/config';
import { ConnectorService, SmythRuntime } from '@sre/index';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { faker } from '@faker-js/faker';
import crypto from 'crypto';
import { VectorsHelper } from '@sre/IO/VectorDB.service/Vectors.helper';
//ConnectorService.register(TConnectorService.Account, 'MyCustomAccountConnector', TestAccountConnector);

const SREInstance = SmythRuntime.Instance.init({
    Account: {
        Connector: 'SmythAccount',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
        },
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
        Connector: 'SmythManaged',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
            openaiApiKey: config.env.OPENAI_API_KEY || '',
        },
    },
});

const EVENTUAL_CONSISTENCY_DELAY = 3_000;

const CONSTANTS = {
    teamId: 'cm1sbspuk0h7ib2b3f3p5mcek',
};

let createdNamespaces: string[] = [];

describe('Integration: Smyth Managed VectorDB', () => {
    // clean up after all tests
    afterAll(async () => {
        const vectorDB = ConnectorService.getVectorDBConnector('SmythManaged');
        const team = AccessCandidate.team(CONSTANTS.teamId);
        const promises = createdNamespaces.map((ns) =>
            vectorDB
                .user(team)
                .deleteNamespace(ns)
                .catch((err) => {})
        );
        await Promise.all(promises);
    });

    describe('Functional', () => {
        describe('Namespaces', () => {
            it('create namespace', async () => {
                const vectorDB = ConnectorService.getVectorDBConnector('SmythManaged');
                const team = AccessCandidate.team(CONSTANTS.teamId);

                const namespaceName = faker.lorem.slug();
                await vectorDB.user(team).createNamespace(namespaceName);
                createdNamespaces.push(namespaceName);
            });

            it("list namespaces should return the created namespace's name", async () => {
                const team = AccessCandidate.team(CONSTANTS.teamId);
                const vectorDB = ConnectorService.getVectorDBConnector('SmythManaged');

                const namespaceSlugs = [faker.lorem.slug(), faker.lorem.slug(), faker.lorem.slug()];
                const promises = namespaceSlugs.map((ns) => vectorDB.user(team).createNamespace(ns));
                await Promise.all(promises);
                createdNamespaces.push(...namespaceSlugs);

                const namespaces = (await vectorDB.user(team).listNamespaces()).map((n) => n.displayName);
                expect(namespaces.length).toBeGreaterThanOrEqual(namespaceSlugs.length);
                expect(namespaces).toEqual(expect.arrayContaining(namespaceSlugs));

                const promises2 = namespaceSlugs.map((ns) => vectorDB.user(team).deleteNamespace(ns));
                await Promise.all(promises2);
            }, 60_000);
        });

        describe('Search', () => {
            it('similiarty search by query', async () => {
                const vectorDB = ConnectorService.getVectorDBConnector('SmythManaged');
                const team = AccessCandidate.team(CONSTANTS.teamId);

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
                createdNamespaces.push(namespace);
                const promises = dummySources.map(async (ds) => vectorDB.user(team).createDatasource(namespace, ds));
                const results = await Promise.all(promises);

                await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

                const searchResult = await vectorDB.user(team).search(namespace, dummySources[0].text, { topK: 10 });

                expect(searchResult).toHaveLength(2);
            }, 60_000);

            it('metadata should be returned with the search result', async () => {
                const vectorDB = ConnectorService.getVectorDBConnector('SmythManaged');
                const team = AccessCandidate.team(CONSTANTS.teamId);

                // insert some dummy vectors to search
                const dummyText = 'Best car in the world';
                const dsId = faker.string.uuid();
                const namespace = faker.string.uuid();
                await vectorDB.user(team).createNamespace(namespace);
                createdNamespaces.push(namespace);

                const dsResponse = await vectorDB.user(team).createDatasource(namespace, {
                    text: dummyText,
                    id: dsId,
                    metadata: {
                        text: dummyText,
                        anotherField: 'another value',
                    },
                });

                await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

                const searchResult = await vectorDB.user(team).search(namespace, dummyText, { topK: 10, includeMetadata: true });
                expect(searchResult).toHaveLength(1);
                expect(searchResult[0].metadata?.user?.text).toBe(dummyText);
                expect(searchResult[0].metadata?.user?.anotherField).toBe('another value');
            }, 60_000);
        });

        describe('Datasources', () => {
            it('insert datasource (large text)', async () => {
                const hugeText = faker.lorem.paragraphs(30);
                const namespace = faker.lorem.slug();
                const team = AccessCandidate.team(CONSTANTS.teamId);
                const vectorDB = ConnectorService.getVectorDBConnector('SmythManaged');

                await vectorDB.user(team).createNamespace(namespace);
                createdNamespaces.push(namespace);
                await vectorDB.user(team).createDatasource(namespace, {
                    text: hugeText,
                });

                const expectedVectorsSize = (await VectorsHelper.chunkText(hugeText)).length;

                await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

                const results = await ConnectorService.getVectorDBConnector()
                    .user(team)
                    .search(namespace, hugeText.slice(0, 100), { topK: expectedVectorsSize });

                expect(results).toHaveLength(expectedVectorsSize);
            });

            it('lists datasources', async () => {
                const namespace = faker.lorem.slug();
                const team = AccessCandidate.team(CONSTANTS.teamId);
                const vectorDB = ConnectorService.getVectorDBConnector('SmythManaged');

                await vectorDB.user(team).createNamespace(namespace);
                createdNamespaces.push(namespace);

                const hugeText = faker.lorem.paragraphs(30);
                await vectorDB.user(team).createDatasource(namespace, {
                    text: hugeText,
                });

                const datasources = await vectorDB.user(team).listDatasources(namespace);

                expect(datasources).toHaveLength(1);
            }, 60_000);

            it('deletes datasource', async () => {
                const namespace = faker.lorem.slug();
                const team = AccessCandidate.team(CONSTANTS.teamId);
                const vectorDB = ConnectorService.getVectorDBConnector('SmythManaged');

                await vectorDB.user(team).createNamespace(namespace);
                createdNamespaces.push(namespace);
                const hugeText = faker.lorem.paragraphs(30);
                const id = crypto.randomUUID();
                const ds = await vectorDB.user(team).createDatasource(namespace, { text: hugeText, id, metadata: { label: 'test' } });

                await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

                const dsBeforeDelete = await vectorDB.user(team).getDatasource(namespace, id);
                expect(dsBeforeDelete).toBeDefined();

                await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

                await vectorDB.user(team).deleteDatasource(namespace, id);

                const dsAfterDelete = await vectorDB.user(team).getDatasource(namespace, id);
                expect(dsAfterDelete).toBeUndefined();
            });
        });
    });

    describe('Security', () => {
        const ownerTeam = AccessCandidate.team('clv1cv00t0001alug52hd69j8');
        const strangerTeam = AccessCandidate.team(CONSTANTS.teamId);

        it('should isolate namespaces with same names for different teams', async () => {
            const vectorDB = ConnectorService.getVectorDBConnector('SmythManaged');

            const namespace = faker.lorem.slug();
            await vectorDB.user(ownerTeam).createNamespace(namespace); // create namespace for the owner
            await vectorDB.user(strangerTeam).createNamespace(namespace); // create namespace for the stranger
            createdNamespaces.push(namespace);

            const text = 'Best car in the world';
            const id = faker.string.uuid();

            await vectorDB.user(ownerTeam).createDatasource(namespace, {
                text,
                id,
                metadata: {
                    text: 'Best car in the world',
                },
            });

            await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

            // expect that the search result would contain the inserted vector for the owner
            const ownerSearchResult = await vectorDB.user(ownerTeam).search(namespace, text, { topK: 10 });
            expect(ownerSearchResult).toHaveLength(1);

            // expect that the search result would not contain the inserted vector for the stranger
            const strangerSearchResult = await vectorDB.user(strangerTeam).search(namespace, text, { topK: 10 });
            expect(strangerSearchResult).toHaveLength(0);
        }, 60_000);

        it('different namespaces should not share vectors', async () => {
            const vectorDB = ConnectorService.getVectorDBConnector();
            const team = AccessCandidate.team(CONSTANTS.teamId);

            // insert some dummy vectors to search
            const v1 = 'Best car in the world';
            const v2 = 'Elephants gardens beatiful';

            const namespace1 = faker.lorem.slug();
            const namespace2 = faker.lorem.slug();
            await vectorDB.user(team).createNamespace(namespace1);
            await vectorDB.user(team).createNamespace(namespace2);
            createdNamespaces.push(namespace1, namespace2);

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
