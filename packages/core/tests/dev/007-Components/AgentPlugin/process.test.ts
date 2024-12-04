import { describe, expect, it, vi } from 'vitest';

import { SmythRuntime } from '@sre/index';
import Agent from '@sre/AgentManager/Agent.class';
import AgentPlugin from '@sre/Components/AgentPlugin.class';

const sre = SmythRuntime.Instance.init({
    CLI: {
        Connector: 'CLI',
    },
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: process.env.AWS_S3_BUCKET_NAME || '',
            region: process.env.AWS_S3_REGION || '',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
    Cache: {
        Connector: 'Redis',
        Settings: {
            hosts: process.env.REDIS_SENTINEL_HOSTS,
            name: process.env.REDIS_MASTER_NAME || '',
            password: process.env.REDIS_PASSWORD || '',
        },
    },
    AgentData: {
        Connector: 'Smyth',
        Settings: {
            agentStageDomain: process.env.AGENT_DOMAIN || '',
            agentProdDomain: process.env.PROD_AGENT_DOMAIN || '',
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
        },
    },
    Account: {
        Connector: 'SmythAccount',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
        },
    },
    Vault: {
        Connector: 'SmythVault',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            vaultAPIBaseUrl: process.env.SMYTH_VAULT_API_BASE_URL,
        },
    },
    ManagedVault: {
        Connector: 'SmythManagedVault',
        Id: 'oauth',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
            vaultName: 'oauth',
        },
    },
});

// Mock Agent class to keep the test isolated from the actual Agent implementation
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => ({
        id: 'cm49rothq1z2cjr2hhfbnht6b',
        agentRuntime: { debug: true }, // used inside createComponentLogger()
        teamId: 'cloilcrl9001v9tkguilsu8dx',
    }));
    return { default: MockedAgent };
});

// @ts-ignore (Ignore required arguments, as we are using the mocked Agent)
const agent = new Agent();
const agentPlugin = new AgentPlugin();

// * NOTE: When try to test the process function and the AgentPlugin component class in a same file we have some conflicts.
// * So, we have to test the process function in a separate file.

describe('AgentPlugin Component - process function', () => {
    it('test process function of AgentPlugin', async () => {
        const input = {
            Prompt: 'hello',
        };
        const subAgentId = 'cm49rotqt1z1nvxncze7d9us6';
        const config = {
            id: '1',
            name: 'AgentPlugin',
            inputs: [
                {
                    name: 'Prompt',
                    type: 'Any',
                    color: '#F35063',
                    optional: false,
                    index: 0,
                    default: true,
                },
            ],
            data: {
                model: 'gpt-4o-mini',
                version: 'same-as-parent',
                descForModel:
                    'A dynamic agent that utilizes a POST API endpoint for interactions and generates prompts for effective communication with language models.',
                agentId: subAgentId,
                id: subAgentId,
                name: 'Sub Agent',
                desc: 'A dynamic agent that utilizes a POST API endpoint for interactions and generates prompts for effective communication with language models.',
            },
        };

        let error;

        try {
            const result = await agentPlugin.process(input, config, agent);
            const output = result?.Response;

            expect(output).toBeDefined();
            expect(output?.length).toBeGreaterThan(20);
            expect(output).toBeTypeOf('string');
        } catch (e) {
            error = e;
            console.error(e.message);
        }
        expect(error).toBeUndefined();
    });
});
