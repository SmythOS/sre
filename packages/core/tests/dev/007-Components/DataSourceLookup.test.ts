import { fa, faker } from '@faker-js/faker';
import DataSourceLookup from '@sre/Components/DataSourceLookup.class';
import { VectorsHelper } from '@sre/IO/VectorDB.service/Vectors.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import config from '@sre/config';
import { Agent, AgentSettings, CLIAgentDataConnector, ConnectorService, SmythRuntime } from '@sre/index';
import { TConnectorService } from '@sre/types/SRE.types';
import fs from 'fs';
import { describe, expect, it } from 'vitest';

const SREInstance = SmythRuntime.Instance.init({
    VectorDB: {
        Connector: 'Pinecone',
        Settings: {
            pineconeApiKey: config.env.PINECONE_API_KEY || '',
            openaiApiKey: config.env.OPENAI_API_KEY || '',
            indexName: config.env.PINCECONE_INDEX_NAME || '',
        },
    },
});

const EVENTUAL_CONSISTENCY_DELAY = 10_000;

ConnectorService.register(TConnectorService.AgentData, 'CLI', CLIAgentDataConnector);
ConnectorService.init(TConnectorService.AgentData, 'CLI');

describe('DataSourceLookup Component', () => {
    it('match similar data correctly', async () => {
        let error;
        const agentData = fs.readFileSync('./tests/data/data-components.smyth', 'utf-8');
        const data = JSON.parse(agentData);
        const date = new Date();

        const agent = new Agent(10, data, new AgentSettings(10));
        agent.teamId = 'default';

        const lookupComp = new DataSourceLookup();

        // index some data using the connector
        const namespace = faker.lorem.word();

        const sourceText = ['What is the capital of France?', 'Paris'];

        await VectorsHelper.load().ingestText(sourceText.join(' '), namespace, {
            teamId: 'default',
            chunkSize: 1000,
            chunkOverlap: 0,
            metadata: {
                text: 'Paris',
            },
        });

        await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

        const output = await lookupComp.process(
            {
                Query: sourceText[0],
            },
            {
                data: {
                    namespace,
                    postprocess: false,
                    prompt: '',
                    includeMetadata: false,
                    topK: 10,
                },
                outputs: [],
            },
            agent
        );

        const results = output.Results;

        expect(results).toBeDefined();
        expect(results.length).toBeGreaterThan(0);
        expect(results.length).toBeLessThanOrEqual(10);
        expect(results.some((result) => result.includes('Paris'))).toBeTruthy();

        expect(output._error).toBeUndefined();

        expect(error).toBeUndefined();
    });

    it('include metadata', async () => {
        let error;
        const agentData = fs.readFileSync('./tests/data/data-components.smyth', 'utf-8');
        const data = JSON.parse(agentData);
        const date = new Date();

        const agent = new Agent(10, data, new AgentSettings(10));
        agent.teamId = 'default';

        const lookupComp = new DataSourceLookup();

        // index some data using the connector
        const namespace = faker.lorem.word();
        const id = faker.lorem.word();
        const sourceText = ['What is the capital of France?', 'Paris'];

        const vectorDB = ConnectorService.getVectorDBConnector();
        await vectorDB.user(AccessCandidate.team(agent.teamId)).insert(namespace, {
            id,
            source: Array.from({ length: 1536 }, () => Math.floor(Math.random() * 100)),
            metadata: {
                user: VectorsHelper.stringifyMetadata({
                    text: 'Paris',
                    meta2: 'meta2',
                }),
            },
        });

        await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

        const output = await lookupComp.process(
            {
                Query: sourceText[0],
            },
            {
                data: {
                    namespace,
                    postprocess: false,
                    prompt: '',
                    includeMetadata: true,
                    topK: 10,
                },
                outputs: [],
            },
            agent
        );

        const results = output.Results;

        expect(results).toBeDefined();
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).not.toBeTypeOf('string');
        expect(results[0]).toBeTypeOf('object');

        expect(results.some((result) => result.metadata.text === 'Paris')).toBeTruthy();
        expect(results.some((result) => result.metadata.meta2 === 'meta2')).toBeTruthy();

        expect(output._error).toBeUndefined();

        expect(error).toBeUndefined;
    });

    // it('postprocess data', async () => {
    //     let error;
    //     try {
    //         const agentData = fs.readFileSync('./tests/data/data-components.smyth', 'utf-8');
    //         const data = JSON.parse(agentData);
    //         const date = new Date();

    //         const agent = new Agent(10, data, new AgentSettings(10));

    //         const lookupComp = new DataSourceLookup();

    //         // index some data using the connector
    //         const namespace = faker.lorem.word();

    //         const sourceText = ['What is the capital of France?', 'Paris'];

    //         await VectorsHelper.load().ingestText(sourceText.join(' '), namespace, {
    //             teamId: agent.teamId,
    //             chunkSize: 1000,
    //             chunkOverlap: 0,
    //             metadata: {
    //                 text: 'Paris',
    //             },
    //         });

    //         await new Promise((resolve) => setTimeout(resolve, EVENTUAL_CONSISTENCY_DELAY));

    //         const output = await lookupComp.process(
    //             {
    //                 Query: 'What is the capital of France?',
    //             },
    //             {
    //                 namespace,
    //                 postprocess: true,
    //                 includeMetadata: true,
    //                 model: 'gpt-3.5-turbo',
    //                 prompt: 'What is the capital of {{result}}?',
    //             },
    //             agent
    //         );

    //         const results = output.Results;

    //         expect(results).toBeDefined();
    //         expect(results.length).toBeGreaterThan(0);

    //         expect(output._error).toBeUndefined();
    //     } catch (e) {
    //         error = e;
    //         console.error(e.message);
    //     }
    //     expect(error).toBeUndefined();
    // });
});
