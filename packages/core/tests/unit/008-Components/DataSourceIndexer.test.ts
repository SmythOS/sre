import { faker } from '@faker-js/faker';
import { DataSourceIndexer } from '@sre/Components/DataSourceIndexer.class';
// import { VectorsHelper } from '@sre/IO/VectorDB.service/Vectors.helper';
import { Agent } from '@sre/AgentManager/Agent.class';
import { AgentSettings } from '@sre/AgentManager/AgentSettings.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import crypto from 'crypto';
import { describe, expect, it } from 'vitest';

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
const EVENTUAL_CONSISTENCY_DELAY = 5_000;

describe('DataSourceIndexer Component', () => {
    it('inserts data on global storage', async () => {
        const data = loadAgentData('AgentData/data-components.smyth');
        const date = new Date();

        const agent = new Agent(10, data, new AgentSettings(10));
        agent.teamId = 'default';

        const indexer = new DataSourceIndexer();

        // index some data using the connector
        const namespace = faker.lorem.word();
        const vectorDbConnector = ConnectorService.getVectorDBConnector();
        await vectorDbConnector.user(AccessCandidate.team(agent.teamId)).createNamespace(namespace);

        const sourceText = ['What is the capital of France?', 'Paris'];

        const dynamic_id = crypto.randomBytes(16).toString('hex');

        await indexer.process(
            {
                Source: sourceText.join(' '),
                dynamic_id,
            },
            {
                data: {
                    namespace,
                    name: 'Paris Datasource',
                    id: '{{dynamic_id}}',
                    metadata: 'Paris',
                },
                outputs: [],
            },
            agent
        );

        await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

        const vectors = await vectorDbConnector.user(AccessCandidate.team('default')).search(namespace, 'Paris');

        expect(vectors).toBeDefined();
        expect(vectors.length).toBeGreaterThan(0);

        // expect(vectors[0].metadata).toBe('Paris');
        expect(vectors.some((result) => result.text?.includes('Paris'))).toBeTruthy();

        // make sure that the datasource was created

        const ds = await vectorDbConnector
            .user(AccessCandidate.team(agent.teamId))
            .getDatasource(namespace, DataSourceIndexer.genDsId(dynamic_id, agent.teamId, namespace));

        expect(ds).toBeDefined();
    });

    it('inserts data on non-existing namespace (implicitly creates it)', async () => {
        const data = loadAgentData('AgentData/data-components.smyth');
        const date = new Date();

        const agent = new Agent(10, data, new AgentSettings(10));
        agent.teamId = 'default';

        const indexer = new DataSourceIndexer();

        // index some data using the connector
        const namespace = faker.lorem.word();
        const vectorDbConnector = ConnectorService.getVectorDBConnector();

        const sourceText = ['What is the capital of France?', 'Paris'];

        const dynamic_id = crypto.randomBytes(16).toString('hex');

        await indexer.process(
            {
                Source: sourceText.join(' '),
                dynamic_id,
            },
            {
                data: {
                    namespace,
                    name: 'Paris Datasource',
                    id: '{{dynamic_id}}',
                    metadata: 'Paris',
                },
                outputs: [],
            },
            agent
        );

        await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

        const vectors = await vectorDbConnector.user(AccessCandidate.team('default')).search(namespace, 'Paris');

        expect(vectors).toBeDefined();
        expect(vectors.length).toBeGreaterThan(0);

        // expect(vectors[0].metadata).toBe('Paris');
        expect(vectors.some((result) => result.text?.includes('Paris'))).toBeTruthy();

        // make sure that the datasource was created

        const ds = await vectorDbConnector
            .user(AccessCandidate.team(agent.teamId))
            .getDatasource(namespace, DataSourceIndexer.genDsId(dynamic_id, agent.teamId, namespace));

        expect(ds).toBeDefined();
    });

    it('inserts data on custom storage', async () => {
        const data = loadAgentData('AgentData/data-components.smyth');
        const agent = new Agent(10, data, new AgentSettings(10));
        agent.teamId = 'default';

        const indexer = new DataSourceIndexer();

        // index some data using the connector
        const namespace = faker.lorem.word();
        // const vectorDBHelper = await VectorsHelper.forTeam(agent.teamId); // load an instance that can access the custom storage (if it exists)
        const vectorDbConnector = ConnectorService.getVectorDBConnector();
        await vectorDbConnector.team(agent.teamId).createNamespace(namespace);

        const sourceText = ['What is the capital of France?', 'Paris'];

        const dynamic_id = crypto.randomBytes(16).toString('hex');

        await indexer.process(
            {
                Source: sourceText.join(' '),
                dynamic_id,
            },
            {
                data: {
                    namespace,
                    name: 'Paris Datasource',
                    id: '{{dynamic_id}}',
                    metadata: 'Paris',
                },
                outputs: [],
            },
            agent
        );

        await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

        // make sure that the datasource was created

        const ds = await vectorDbConnector
            .user(AccessCandidate.team(agent.teamId))
            .getDatasource(namespace, DataSourceIndexer.genDsId(dynamic_id, agent.teamId, namespace));
        expect(ds).toBeDefined();

        const vectors = await vectorDbConnector.user(AccessCandidate.team(agent.teamId)).search(namespace, 'Paris');
        expect(vectors).toBeDefined();
        expect(vectors.length).toBeGreaterThan(0);
        expect(vectors.some((result) => result.text?.includes('Paris'))).toBeTruthy();

        const globalVectorDbConnector = ConnectorService.getVectorDBConnector();
        //* expect an error because we tried to access a namespace that exists on custom storage
        const globalVectors = await globalVectorDbConnector
            .user(AccessCandidate.team('different-team'))
            .search(namespace, 'Paris')
            .catch((e) => []);
        expect(globalVectors).toBeDefined();
        expect(globalVectors.length).toBe(0);
    });
});
