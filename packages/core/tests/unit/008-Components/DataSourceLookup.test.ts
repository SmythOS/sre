import { faker } from '@faker-js/faker';
import { DataSourceLookup } from '@sre/Components/RAG/DataSourceLookup.class';
// import { VectorsHelper } from '@sre/IO/VectorDB.service/Vectors.helper';
import { Agent } from '@sre/AgentManager/Agent.class';
import { AgentSettings } from '@sre/AgentManager/AgentSettings.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import fs from 'fs';
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

describe('DataSourceLookup Component', () => {
    it('match similar data correctly', async () => {
        let error;
        const data = loadAgentData('AgentData/data-components.smyth');
        const date = new Date();

        const agent = new Agent(10, data, new AgentSettings(10));
        agent.teamId = 'default';

        const lookupComp = new DataSourceLookup();

        // index some data using the connector
        const namespace = faker.lorem.word();
        const vectorDbConnector = ConnectorService.getVectorDBConnector();

        await vectorDbConnector.user(AccessCandidate.team(agent.teamId)).createNamespace(namespace);

        const sourceText = ['What is the capital of France?', 'Paris'];

        await vectorDbConnector.user(AccessCandidate.team('default')).createDatasource(namespace, {
            text: sourceText.join(' '),
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
        const data = loadAgentData('AgentData/data-components.smyth');
        const date = new Date();

        const agent = new Agent(10, data, new AgentSettings(10));
        agent.teamId = 'default';

        const lookupComp = new DataSourceLookup();

        // index some data using the connector
        const namespace = faker.lorem.word();

        const vectorDbConnector = ConnectorService.getVectorDBConnector();
        await vectorDbConnector.user(AccessCandidate.team(agent.teamId)).createNamespace(namespace);
        const id = faker.lorem.word();
        const sourceText = ['What is the capital of France?', 'Paris'];

        // await vectorDbConnector.user(AccessCandidate.team(agent.teamId)).insert(namespace, {
        //     id,
        //     source: Array.from({ length: 1536 }, () => Math.floor(Math.random() * 100)),
        //     metadata: {
        //         user: VectorsHelper.stringifyMetadata({
        //             text: 'Paris',
        //             meta2: 'meta2',
        //         }),
        //     },
        // });
        const text = 'Any matching text';
        await vectorDbConnector.user(AccessCandidate.team(agent.teamId)).createDatasource(namespace, {
            id,
            text,
            metadata: {
                text: 'Paris',
                meta2: 'meta2',
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

    it('lookup data in custom storage', async () => {
        let error;

        const data = loadAgentData('AgentData/data-components.smyth');
        const date = new Date();

        const agent = new Agent(10, data, new AgentSettings(10));
        agent.teamId = 'default';

        const lookupComp = new DataSourceLookup();

        const namespace = faker.lorem.word();
        // const vectorDbHelper = await VectorsHelper.forTeam(agent.teamId);
        const vectorDbConnector = ConnectorService.getVectorDBConnector();
        await vectorDbConnector.user(AccessCandidate.team(agent.teamId)).createNamespace(namespace);
        const id = faker.lorem.word();
        const sourceText = ['What is the capital of France?', 'Paris'];

        await vectorDbConnector.user(AccessCandidate.team('default')).createDatasource(namespace, {
            text: sourceText.join(' '),
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
        expect(results.some((result) => result.includes('Paris'))).toBeTruthy();
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
