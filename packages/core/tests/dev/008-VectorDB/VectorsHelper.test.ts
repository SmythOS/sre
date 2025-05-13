import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import config from '@sre/config';
import { ConnectorService, SmythRuntime } from '@sre/index';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { PineconeVectorDB } from '@sre/IO/VectorDB.service/connectors/PineconeVectorDB.class';
import { faker } from '@faker-js/faker';
import { VectorsHelper } from '@sre/IO/VectorDB.service/Vectors.helper';
import { IVectorDataSourceDto, SourceTypes } from '@sre/types/VectorDB.types';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { TConnectorService } from '@sre/types/SRE.types';
import crypto from 'crypto';
import { VectorDBConnector } from '@sre/IO/VectorDB.service/VectorDBConnector';
import { TestAccountConnector } from '../../utils/TestConnectors';

class CustomAccountConnector extends TestAccountConnector {
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
                // await vectorDB
                //     .user(team)
                //     .delete(id.namespace, [id.id])
                //     .catch((e) => {});

                await vectorDB
                    .user(team)
                    .deleteNamespace(id.namespace)
                    .catch((e) => {});
            }
        });

        beforeEach(() => {
            vi.clearAllMocks();
        });

        describe('Custom VectorDB', () => {
            beforeAll(async () => {
                // check if the vault.json 'vectorDB:customStorage:pinecone' is set to the correct value
                const vault = ConnectorService.getVaultConnector();
                const team1CustomStorage = await vault
                    .user(AccessCandidate.team('default'))
                    .get(VectorsHelper.load().cusStorageKeyName)
                    .catch(() => null);

                if (!team1CustomStorage) {
                    throw new Error(`Please set the vectorDB:customStorage:pinecone key in 'default' team inside the vault.json file`);
                }
            });

            it('create an instance of VectorDb connector with custom storage config', async () => {
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

                const expectedConfig = {
                    ...teamCustomConfig,
                    isCustomStorageInstance: true,
                };
                const customStorageConnector = await VectorsHelper.load().getTeamConnector(team.id);
                // expect(customStorageConnector).toBeInstanceOf(VectorsHelper);

                expect((customStorageConnector as any).config).toEqual(expectedConfig);
            });

            it('creates namespaces on team custom storage', async () => {
                const namespace = faker.lorem.slug();
                const team = AccessCandidate.team('Team1');
                const { spy, teamCustomConfig } = await mockCustomStorageConfig();
                const helper = VectorsHelper.load();
                const customStorageConnector = await helper.getTeamConnector(team.id);

                await customStorageConnector.user(team).createNamespace(namespace);

                const isOnCustomStorage = await helper.isNamespaceOnCustomStorage(team.id, namespace);
                expect(isOnCustomStorage).toBe(true);
            });

            it('should return the team-specific custom vectorDB if it exists', async () => {
                await mockCustomStorageConfig({ pineconeApiKey: '1', indexName: 'test', environment: 'us-east-1' });

                // vi.spyOn(helper, 'getCustomStorageConfig').mockResolvedValue({ pineconeApiKey: '1', indexName: 'test', environment: 'us-east-1' });

                const vectorDB = await VectorsHelper.load().getTeamConnector('9');
                expect(vectorDB).toBeDefined();
            });

            it('should return true only if namespace is on custom storage', async () => {
                const team = AccessCandidate.team('Team1');

                const vectorDB = await VectorsHelper.load().getTeamConnector('100');
                expect(vectorDB).toEqual(null);

                const { spy, teamCustomConfig } = await mockCustomStorageConfig();
                const helper = VectorsHelper.load();
                const customVectorDB = await helper.getTeamConnector(team.id);

                await customVectorDB.user(team).createNamespace('test');

                const isOnCustomStorage = await helper.isNamespaceOnCustomStorage(team.id, 'test');
                expect(isOnCustomStorage).toBe(true);
            });

            it('should return false if namespace is not on custom storage', async () => {
                const helper = VectorsHelper.load();
                vi.spyOn(helper, 'getCustomStorageConfig').mockResolvedValue(null);

                const team = AccessCandidate.team('Team1');
                const vectorDB = ConnectorService.getVectorDBConnector();

                await vectorDB.user(team).createNamespace('test');

                const isOnCustomStorage = await helper.isNamespaceOnCustomStorage(team.id, 'test');
                expect(isOnCustomStorage).toBe(false);
            });

            it('should insert datasource on custom storage', async () => {
                const namespace = faker.lorem.slug();
                const team = AccessCandidate.team('default');

                const globalConnector = ConnectorService.getVectorDBConnector();
                const customStorageConnector = await VectorsHelper.load().getTeamConnector(team.id);
                await customStorageConnector.user(team).createNamespace(namespace);

                const hugeText = faker.lorem.paragraphs(30);

                const datasource = await customStorageConnector.user(team).createDatasource(namespace, { text: hugeText });
                expect(datasource).toBeDefined();
                await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

                // search vectors on global storage and expect 0 results
                //* expect an error because we are not using the custom storage and the helper does a pre-check before calling the vectorDB connector
                const globalStorageResults = await globalConnector
                    .user(team)
                    .search(namespace, hugeText)
                    .catch(() => []);
                expect(globalStorageResults).toHaveLength(0);

                // search vectors on custom storage and expect 1 or more results
                const customStorageResults = await customStorageConnector.user(team).search(namespace, hugeText);
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
