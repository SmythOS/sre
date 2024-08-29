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
import crypto from 'crypto';

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

        it('insert datasource (large text)', async () => {
            const hugeText = faker.lorem.paragraphs(30);
            const namespace = faker.lorem.slug();
            const vectorDB = ConnectorService.getVectorDBConnector() as PineconeVectorDB;
            const team = AccessCandidate.team('team-123');
            await vectorDB.user(team).createNamespace(namespace);
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
            const vectorDB = ConnectorService.getVectorDBConnector() as PineconeVectorDB;
            const team = AccessCandidate.team('team-123');
            await vectorDB.user(team).createNamespace(namespace);

            const hugeText = faker.lorem.paragraphs(30);
            await VectorsHelper.load().createDatasource(hugeText, namespace, { teamId: 'team-123' });

            const datasources = await VectorsHelper.load().listDatasources('team-123', namespace);

            expect(datasources).toHaveLength(1);
        });

        it('deletes datasource', async () => {
            const namespace = faker.lorem.slug();
            const vectorDB = ConnectorService.getVectorDBConnector() as PineconeVectorDB;
            const team = AccessCandidate.team('team-123');
            await vectorDB.user(team).createNamespace(namespace);

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
});
