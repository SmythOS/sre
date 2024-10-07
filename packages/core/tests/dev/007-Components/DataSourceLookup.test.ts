import { fa, faker } from '@faker-js/faker';
import DataSourceLookup from '@sre/Components/DataSourceLookup.class';
import { VectorsHelper } from '@sre/IO/VectorDB.service/Vectors.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import config from '@sre/config';
import { Agent, AgentSettings, CLIAgentDataConnector, ConnectorService, SmythRuntime } from '@sre/index';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { TConnectorService } from '@sre/types/SRE.types';
import fs from 'fs';
import { describe, expect, it } from 'vitest';
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
        const vectorDBHelper = VectorsHelper.load();
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

    it('run a similarity search for non-existing namespace (implicitly creates it)', async () => {
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
        expect(results.length).toBe(0);

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
        const vectorDBHelper = VectorsHelper.load();
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
        const agentData = fs.readFileSync('./tests/data/data-components.smyth', 'utf-8');
        const data = JSON.parse(agentData);
        const date = new Date();

        const agent = new Agent(10, data, new AgentSettings(10));
        agent.teamId = 'default';

        const lookupComp = new DataSourceLookup();

        const namespace = faker.lorem.word();
        // const vectorDbHelper = await VectorsHelper.forTeam(agent.teamId);
        const vectorDBHelper = VectorsHelper.load();
        const vectorDbConnector = await vectorDBHelper.getTeamConnector(agent.teamId);
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
