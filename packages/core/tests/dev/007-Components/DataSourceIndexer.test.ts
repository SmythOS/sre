import { faker } from '@faker-js/faker';
import DataSourceIndexer from '@sre/Components/DataSourceIndexer.class';
import { VectorsHelper } from '@sre/IO/VectorDB.service/Vectors.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import config from '@sre/config';
import { Agent, AgentSettings, CLIAgentDataConnector, ConnectorService, SmythRuntime } from '@sre/index';
import { TConnectorService } from '@sre/types/SRE.types';
import fs from 'fs';
import { describe, expect, it } from 'vitest';
import crypto from 'crypto';
import { SmythFS } from '@sre/IO/Storage.service/SmythFS.class';

const SREInstance = SmythRuntime.Instance.init({
    VectorDB: {
        Connector: 'Pinecone',
        Settings: {
            pineconeApiKey: config.env.PINECONE_API_KEY || '',
            openaiApiKey: config.env.OPENAI_API_KEY || '',
            indexName: config.env.PINCECONE_INDEX_NAME || '',
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
});

const EVENTUAL_CONSISTENCY_DELAY = 10_000;

ConnectorService.register(TConnectorService.AgentData, 'CLI', CLIAgentDataConnector);
ConnectorService.init(TConnectorService.AgentData, 'CLI');

describe('DataSourceIndexer Component', () => {
    it('inserts data', async () => {
        const agentData = fs.readFileSync('./tests/data/data-components.smyth', 'utf-8');
        const data = JSON.parse(agentData);
        const date = new Date();

        const agent = new Agent(10, data, new AgentSettings(10));
        agent.teamId = 'default';

        const indexer = new DataSourceIndexer();

        // index some data using the connector
        const namespace = faker.lorem.word();

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

        const vectorDB = ConnectorService.getVectorDBConnector();

        const vectors = await vectorDB.user(AccessCandidate.team('default')).search(namespace, 'Paris');

        expect(vectors).toBeDefined();
        expect(vectors.length).toBeGreaterThan(0);

        // expect(vectors[0].metadata).toBe('Paris');
        expect(vectors.some((result) => result.metadata?.text.includes('Paris'))).toBeTruthy();

        // make sure that the datasource was created
        const url = `smythfs://${agent.teamId}.team/_datasources/${indexer.generateContextUID(dynamic_id, agent.teamId, namespace)}.json`;

        const exists = await SmythFS.Instance.exists(url, AccessCandidate.team(agent.teamId));

        expect(exists).toBeTruthy();
    });
});
