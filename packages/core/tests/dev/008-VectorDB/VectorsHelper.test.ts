import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
import crypto from 'crypto';
import { VectorDBConnector } from '@sre/IO/VectorDB.service/VectorDBConnector';

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

    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './tests/data/vault.json',
        },
    },
});

const EVENTUAL_CONSISTENCY_DELAY = 4_000;

describe('Integration: VectorDB Helper', () => {
    describe('Functional', () => {
        const idsToClean: { id: string; namespace: string }[] = [];
        //* Cleanup
        afterAll(async () => {
            const vectorDB = ConnectorService.getVectorDBConnector();
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

        beforeEach(() => {
            vi.clearAllMocks();
        });

        describe('Namespaces', () => {
            it('create namespace', async () => {
                const vectorDBHelper = VectorsHelper.load();

                const team = AccessCandidate.team('team-123456');

                await vectorDBHelper.createNamespace(team.id, faker.lorem.slug());
            });

            it("list namespaces should return the created namespace's name", async () => {
                const vectorDBHelper = VectorsHelper.load();
                const team = AccessCandidate.team('team-123456');

                const namespaceSlugs = [faker.lorem.slug(), faker.lorem.slug(), faker.lorem.slug()];
                const promises = namespaceSlugs.map((ns) => vectorDBHelper.createNamespace(team.id, ns));
                await Promise.all(promises);

                const namespaces = (await vectorDBHelper.listNamespaces(team.id)).map((n) => n.displayName);
                expect(namespaces.length).toBeGreaterThanOrEqual(namespaceSlugs.length);
                expect(namespaces).toEqual(expect.arrayContaining(namespaceSlugs));

                const promises2 = namespaceSlugs.map((ns) => vectorDBHelper.deleteNamespace(team.id, ns));
                await Promise.all(promises2);
            }, 60_000);
        });

        describe('Datasources', () => {
            it('insert datasource (large text)', async () => {
                const hugeText = faker.lorem.paragraphs(30);
                const namespace = faker.lorem.slug();
                const vectorDB = ConnectorService.getVectorDBConnector() as PineconeVectorDB;
                const team = AccessCandidate.team('team-123');
                await VectorsHelper.load().createNamespace(team.id, namespace);
                await VectorsHelper.load().createDatasource(hugeText, namespace, { teamId: 'team-123' });

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
                await VectorsHelper.load().createNamespace(team.id, namespace);

                const hugeText = faker.lorem.paragraphs(30);
                await VectorsHelper.load().createDatasource(hugeText, namespace, { teamId: 'team-123' });

                const datasources = await VectorsHelper.load().listDatasources('team-123', namespace);

                expect(datasources).toHaveLength(1);
            }, 60_000);

            it('deletes datasource', async () => {
                const namespace = faker.lorem.slug();
                const team = AccessCandidate.team('team-123');
                await VectorsHelper.load().createNamespace(team.id, namespace);

                const hugeText = faker.lorem.paragraphs(30);
                const id = crypto.randomUUID();
                await VectorsHelper.load().createDatasource(hugeText, namespace, { teamId: 'team-123', id, metadata: { label: 'test' } });

                const dsBeforeDelete = await VectorsHelper.load().getDatasource('team-123', namespace, id);
                expect(dsBeforeDelete).toBeDefined();

                await VectorsHelper.load().deleteDatasource('team-123', namespace, id);

                const dsAfterDelete = await VectorsHelper.load().getDatasource('team-123', namespace, id);
                expect(dsAfterDelete).toBeUndefined();
            });
        });

        describe('Custom VectorDB', () => {
            beforeAll(async () => {
                // check if the vault.json 'vectorDB:customStorage:pinecone' is set to the correct value
                const vault = ConnectorService.getVaultConnector();
                const team1CustomStorage = vault
                    .user(AccessCandidate.team('default'))
                    .get(VectorsHelper.load().cusStorageKeyName)
                    .catch(() => null);

                if (!team1CustomStorage) {
                    throw new Error(`Please set the vectorDB:customStorage:pinecone key in 'default' team inside the vault.json file`);
                }
            });
            it('create an instance of VectorsHelper with custom storage', async () => {
                const team = AccessCandidate.team('Team1');

                vi.mock('@sre/IO/VectorDB.service/connectors/PineconeVectorDB.class', async () => {
                    const originalPinecone = (
                        await vi.importActual<typeof import('@sre/IO/VectorDB.service/connectors/PineconeVectorDB.class')>(
                            '@sre/IO/VectorDB.service/connectors/PineconeVectorDB.class'
                        )
                    ).PineconeVectorDB;
                    return {
                        PineconeVectorDB: class extends originalPinecone {
                            public config: any;

                            constructor(config: any, changed?: boolean) {
                                super(config);
                                this.config = config; // set for checking if it was initialized with correct config
                            }
                        },
                    };
                });
                const { spy, teamCustomConfig } = await mockCustomStorageConfig();
                const vectorDBHelper = await VectorsHelper.forTeam(team.id);
                expect(vectorDBHelper).toBeInstanceOf(VectorsHelper);

                const vectorConnector = (vectorDBHelper as any)._vectorDBconnector as VectorDBConnector;
                expect((vectorConnector as any).config).toEqual(teamCustomConfig);
            });

            it('creates namespaces on team custom storage', async () => {
                const namespace = faker.lorem.slug();
                const team = AccessCandidate.team('Team1');
                const { spy, teamCustomConfig } = await mockCustomStorageConfig();
                const vectorDBHelper = await VectorsHelper.forTeam(team.id);

                await vectorDBHelper.createNamespace(team.id, namespace);

                const isOnCustomStorage = await vectorDBHelper.isNamespaceOnCustomStorage(team.id, namespace);
                expect(isOnCustomStorage).toBe(true);
            });

            it('should return the team-specific custom vectorDB if it exists', async () => {
                await mockCustomStorageConfig({ pineconeApiKey: '1', indexName: 'test', environment: 'us-east-1' });
                const helper = await VectorsHelper.forTeam('9');

                // vi.spyOn(helper, 'getCustomStorageConfig').mockResolvedValue({ pineconeApiKey: '1', indexName: 'test', environment: 'us-east-1' });

                const vectorDB = await helper.getTeamVectorDB('9');
                expect(vectorDB).toBeDefined();
            });

            it('should return true only if namespace is on custom storage', async () => {
                const team = AccessCandidate.team('Team1');

                const vectorDB = await VectorsHelper.load().getTeamVectorDB('100');
                expect(vectorDB).toBeNull();

                const { spy, teamCustomConfig } = await mockCustomStorageConfig();
                const helper = await VectorsHelper.forTeam(team.id);

                await helper.createNamespace(team.id, 'test');

                const isOnCustomStorage = await helper.isNamespaceOnCustomStorage(team.id, 'test');
                expect(isOnCustomStorage).toBe(true);
            });

            it('should return false if namespace is not on custom storage', async () => {
                const helper = VectorsHelper.load();
                vi.spyOn(helper, 'getCustomStorageConfig').mockResolvedValue(null);

                const team = AccessCandidate.team('Team1');
                await helper.createNamespace(team.id, 'test');

                const isOnCustomStorage = await helper.isNamespaceOnCustomStorage(team.id, 'test');
                expect(isOnCustomStorage).toBe(false);
            });

            it('should insert datasource on custom storage', async () => {
                const namespace = faker.lorem.slug();
                const team = AccessCandidate.team('default');

                const customStorageVectorDbHelper = await VectorsHelper.forTeam(team.id);
                const globalStorageVectorDbHelper = VectorsHelper.load();

                await customStorageVectorDbHelper.createNamespace(team.id, namespace);

                const hugeText = faker.lorem.paragraphs(30);

                const datasource = await customStorageVectorDbHelper.createDatasource(hugeText, namespace, { teamId: team.id });
                expect(datasource).toBeDefined();
                await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

                // search vectors on global storage and expect 0 results
                //* expect an error because we are not using the custom storage and the helper does a pre-check before calling the vectorDB connector
                const globalStorageResults = await globalStorageVectorDbHelper.search(team.id, namespace, hugeText).catch(() => []);
                expect(globalStorageResults).toHaveLength(0);

                // search vectors on custom storage and expect 1 or more results
                const customStorageResults = await customStorageVectorDbHelper.search(team.id, namespace, hugeText);
                expect(customStorageResults.length).toBeGreaterThanOrEqual(1);
            }, 60_000);
        });
    });
});

async function mockCustomStorageConfig(config?: any) {
    const original = (await vi.importActual<typeof import('@sre/IO/VectorDB.service/Vectors.helper')>('@sre/IO/VectorDB.service/Vectors.helper'))
        .VectorsHelper;

    const teamCustomConfig = config || {
        pineconeApiKey: 'TEAM_API_KEY',
        indexName: 'TEAM_INDEX',
        openaiApiKey: 'TEAM_OPENAI_API_KEY',
    };
    const spy = vi.spyOn(original.prototype, 'getCustomStorageConfig').mockResolvedValueOnce(teamCustomConfig);

    return { spy, teamCustomConfig };
}
