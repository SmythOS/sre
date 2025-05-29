import { faker } from '@faker-js/faker';
import { DataSourceIndexer } from '@sre/Components/DataSourceIndexer.class';
import { VectorsHelper } from '@sre/IO/VectorDB.service/Vectors.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import config from '@sre/config';
import { Agent } from '@sre/AgentManager/Agent.class';
import { AgentSettings } from '@sre/AgentManager/AgentSettings.class';
import { CLIAgentDataConnector } from '@sre/AgentManager/AgentData.service/connectors/CLIAgentDataConnector.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { TConnectorService } from '@sre/types/SRE.types';
import fs from 'fs';
import { describe, expect, it } from 'vitest';
import crypto from 'crypto';
import { SmythFS } from '@sre/IO/Storage.service/SmythFS.class';
import { VectorDBConnector } from '@sre/IO/VectorDB.service/VectorDBConnector';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { IAccessCandidate } from '@sre/types/ACL.types';
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
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: config.env.AWS_S3_BUCKET_NAME || '',
            region: config.env.AWS_S3_REGION || '',
            accessKeyId: config.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: config.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './tests/data/vault.json',
        },
    },
});

const EVENTUAL_CONSISTENCY_DELAY = 5_000;

ConnectorService.register(TConnectorService.AgentData, 'CLI', CLIAgentDataConnector);
ConnectorService.init(TConnectorService.AgentData, 'CLI');

describe('DataSourceIndexer Component', () => {
    it('inserts data on global storage', async () => {
        const agentData = fs.readFileSync('./tests/data/data-components.smyth', 'utf-8');
        const data = JSON.parse(agentData);
        const date = new Date();

        const agent = new Agent(10, data, new AgentSettings(10));
        agent.teamId = 'default';

        const indexer = new DataSourceIndexer();

        // index some data using the connector
        const namespace = faker.lorem.word();
        const vectorDBHelper = VectorsHelper.load();
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
            agent,
        );

        await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

        const vectors = await vectorDbConnector.user(AccessCandidate.team('default')).search(namespace, 'Paris');

        expect(vectors).toBeDefined();
        expect(vectors.length).toBeGreaterThan(0);

        // expect(vectors[0].metadata).toBe('Paris');
        expect(vectors.some((result) => result.metadata?.text.includes('Paris'))).toBeTruthy();

        // make sure that the datasource was created

        const ds = await vectorDbConnector
            .user(AccessCandidate.team(agent.teamId))
            .getDatasource(namespace, DataSourceIndexer.genDsId(dynamic_id, agent.teamId, namespace));

        expect(ds).toBeDefined();
    });

    it('inserts data on non-existing namespace (implicitly creates it)', async () => {
        const agentData = fs.readFileSync('./tests/data/data-components.smyth', 'utf-8');
        const data = JSON.parse(agentData);
        const date = new Date();

        const agent = new Agent(10, data, new AgentSettings(10));
        agent.teamId = 'default';

        const indexer = new DataSourceIndexer();

        // index some data using the connector
        const namespace = faker.lorem.word();
        const vectorDBHelper = VectorsHelper.load();
        const vectorDbConnector = (await vectorDBHelper.getTeamConnector(agent.teamId)) || ConnectorService.getVectorDBConnector();

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
            agent,
        );

        await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

        const vectors = await vectorDbConnector.user(AccessCandidate.team('default')).search(namespace, 'Paris');

        expect(vectors).toBeDefined();
        expect(vectors.length).toBeGreaterThan(0);

        // expect(vectors[0].metadata).toBe('Paris');
        expect(vectors.some((result) => result.metadata?.text.includes('Paris'))).toBeTruthy();

        // make sure that the datasource was created

        const ds = await vectorDbConnector
            .user(AccessCandidate.team(agent.teamId))
            .getDatasource(namespace, DataSourceIndexer.genDsId(dynamic_id, agent.teamId, namespace));

        expect(ds).toBeDefined();
    });

    it('inserts data on custom storage', async () => {
        const agentData = fs.readFileSync('./tests/data/data-components.smyth', 'utf-8');
        const data = JSON.parse(agentData);
        const agent = new Agent(10, data, new AgentSettings(10));
        agent.teamId = 'default';

        const indexer = new DataSourceIndexer();

        // index some data using the connector
        const namespace = faker.lorem.word();
        // const vectorDBHelper = await VectorsHelper.forTeam(agent.teamId); // load an instance that can access the custom storage (if it exists)
        const vectorDBHelper = VectorsHelper.load();
        const vectorDbConnector = await vectorDBHelper.getTeamConnector(agent.teamId);
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
            agent,
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
        expect(vectors.some((result) => result.metadata?.text.includes('Paris'))).toBeTruthy();

        const globalVectorDbConnector = ConnectorService.getVectorDBConnector();
        //* expect an error because we tried to access a namespace that exists on custom storage
        const globalVectors = await globalVectorDbConnector
            .user(AccessCandidate.team(agent.teamId))
            .search(namespace, 'Paris')
            .catch((e) => []);
        expect(globalVectors).toBeDefined();
        expect(globalVectors.length).toBe(0);
    });
});
