import { faker } from '@faker-js/faker';
import { DataSourceIndexer } from '@sre/Components/RAG/DataSourceIndexer.class';
// import { VectorsHelper } from '@sre/IO/VectorDB.service/Vectors.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { Agent } from '@sre/AgentManager/Agent.class';
import { AgentSettings } from '@sre/AgentManager/AgentSettings.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { describe, expect, it } from 'vitest';
import crypto from 'crypto';
import { DataSourceCleaner } from '@sre/Components/RAG/DataSourceCleaner.class';
import { setupSRE } from '../../utils/sre';
import { loadAgentData } from '../../utils/test-data-manager';

setupSRE({
    VectorDB: {
        Connector: 'RAMVec',
        Settings: {
            embeddings: {
                provider: 'OpenAI',
                model: 'text-embedding-3-large',
                params: {
                    dimensions: 1024,
                },
            },
        },
    },
});

describe('DataSourceCleaner Component', () => {
    it(
        'deletes datasources created by DataSourceIndexer',
        async () => {
            const data = loadAgentData('AgentData/data-components.smyth');
            const date = new Date();

            const agent = new Agent(10, data, new AgentSettings(10));
            agent.teamId = 'default';

            const cleaner = new DataSourceCleaner();
            const indexer = new DataSourceIndexer();

            // index some data using the connector
            const namespace = faker.lorem.word();
            const vectorDbConnector = ConnectorService.getVectorDBConnector();
            await vectorDbConnector.user(AccessCandidate.team(agent.teamId)).createNamespace(namespace);

            const sourceText = ['What is the capital of France?', 'Paris'];

            const dynamic_id = crypto.randomBytes(16).toString('hex');

            const res = await indexer.process(
                {
                    Source: sourceText.join(' '),
                },
                {
                    data: {
                        namespace,
                        id: dynamic_id,
                        name: faker.lorem.word(),
                        metadata: faker.lorem.sentence(),
                    },
                    outputs: [],
                },
                agent
            );

            // expect that the datasource file exists now
            // const existsAfterInsert = await SmythFS.Instance.exists(dsUrl, AccessCandidate.team(agent.teamId));
            const id = res.Success?.id;

            expect(id).toBeDefined();

            const dsBeforeDel = await vectorDbConnector
                .user(AccessCandidate.team(agent.teamId))
                .getDatasource(namespace, DataSourceIndexer.normalizeDsId(dynamic_id, agent.teamId, namespace));

            expect(dsBeforeDel).toBeDefined();

            await cleaner.process(
                {
                    Source: sourceText.join(' '),
                },
                {
                    data: {
                        namespaceId: namespace,
                        id: dynamic_id,
                    },
                    outputs: [],
                },
                agent
            );

            // expect that the datasource file does not exist now
            // const existsAfterDelete = await SmythFS.Instance.exists(dsUrl, AccessCandidate.team(agent.teamId));

            const dsAfterDel = await vectorDbConnector
                .user(AccessCandidate.team(agent.teamId))
                .getDatasource(namespace, DataSourceIndexer.normalizeDsId(dynamic_id, agent.teamId, namespace));

            expect(dsAfterDel).toBeUndefined();

            // expect that all the embeddings are deleted. we can do that by doing a similar search on the data we indexed

            const vectors = await vectorDbConnector.user(AccessCandidate.team(agent.teamId)).search(namespace, 'Paris');

            expect(vectors).toBeDefined();
            expect(vectors.length).toBe(0);
        },
        {
            timeout: 35_000,
        }
    );
});
