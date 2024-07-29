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
import DataSourceCleaner from '@sre/Components/DataSourceCleaner.class';

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

describe('DataSourceCleaner Component', () => {
    it('deletes datasources created by DataSourceIndexer', async () => {
        const agentData = fs.readFileSync('./tests/data/data-components.smyth', 'utf-8');
        const data = JSON.parse(agentData);
        const date = new Date();

        const agent = new Agent(10, data, new AgentSettings(10));
        agent.teamId = 'default';

        const cleaner = new DataSourceCleaner();
        const indexer = new DataSourceIndexer();

        // index some data using the connector
        const namespace = faker.lorem.word();

        const sourceText = ['What is the capital of France?', 'Paris'];

        const dynamic_id = crypto.randomBytes(16).toString('hex');

        const dsUrl = `smythfs://${agent.teamId}.team/_datasources/${indexer.generateContextUID(dynamic_id, agent.teamId, namespace)}.json`;

        await indexer.process(
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
        const existsAfterInsert = await SmythFS.Instance.exists(dsUrl, AccessCandidate.team(agent.teamId));
        expect(existsAfterInsert).toBe(true);

        // wait for the data to be indexed
        await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

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
        const existsAfterDelete = await SmythFS.Instance.exists(dsUrl, AccessCandidate.team(agent.teamId));
        expect(existsAfterDelete).toBe(false);

        // expect that all the embeddings are deleted. we can do that by doing a similar search on the data we indexed
        const vectorDB = ConnectorService.getVectorDBConnector();

        const vectors = await vectorDB.user(AccessCandidate.team(agent.teamId)).search(namespace, 'Paris');

        expect(vectors).toBeDefined();
        expect(vectors.length).toBe(0);
    });
});
