import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import config from '@sre/config';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import axios from 'axios';

//ConnectorService.register(TConnectorService.Account, 'MyCustomAccountConnector', TestAccountConnector);

const SREInstance = SmythRuntime.Instance.init({
    Account: {
        Connector: 'DummyAccount',
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
    AgentData: {
        Connector: 'Smyth',
        Settings: {
            agentStageDomain: config.env.AGENT_DOMAIN || '',
            agentProdDomain: config.env.PROD_AGENT_DOMAIN || '',
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
        },
    },
});

const CONSTANTS = {
    DEPLOYED_AGENT_ID: 'cm1sbugyp0h5is1jg9436wrxi',
    UNDEPLOYED_AGENT_ID: 'cm1sc9q2e0hfls1jgeklrpyam',
    LATEST_DEPLOYMENT_VERSION: '1.5',
};

describe('SmythAgentData Tests', () => {
    it('should get agent data by id', async () => {
        const agentConnector = ConnectorService.getAgentDataConnector('Smyth');
        const agentData = await agentConnector.getAgentData(CONSTANTS.DEPLOYED_AGENT_ID);
        expect(agentData).toBeDefined();
        expect(agentData.data?.id).toBe(CONSTANTS.DEPLOYED_AGENT_ID);
    });

    it('should get deployed agent data by version number', async () => {
        const agentConnector = ConnectorService.getAgentDataConnector('Smyth');
        const agentData = await agentConnector.getAgentData(CONSTANTS.DEPLOYED_AGENT_ID, '1.2');
        expect(agentData).toBeDefined();
        expect(agentData.version).toBe('1.2');
    });

    it('should get latest agent deployment data', async () => {
        const agentConnector = ConnectorService.getAgentDataConnector('Smyth');
        const agentData = await agentConnector.getAgentData(CONSTANTS.DEPLOYED_AGENT_ID, 'latest');
        expect(agentData).toBeDefined();
        expect(agentData.version).toBe(CONSTANTS.LATEST_DEPLOYMENT_VERSION);
    });

    it('should get agent id by registered domain', async () => {});

    it('should get agent id by our provided ready-to-use domain', async () => {
        const devDomain = `${CONSTANTS.DEPLOYED_AGENT_ID}.${config.env.AGENT_DOMAIN}`;
        const prodDomain = `${CONSTANTS.DEPLOYED_AGENT_ID}.${config.env.PROD_AGENT_DOMAIN}`;
        const agentConnector = ConnectorService.getAgentDataConnector('Smyth');
        const agentId = await agentConnector.getAgentIdByDomain(devDomain);
        expect(agentId, 'Failed to get agent id by dev domain').toBe(CONSTANTS.DEPLOYED_AGENT_ID);

        const agentIdProd = await agentConnector.getAgentIdByDomain(prodDomain);
        expect(agentIdProd, 'Failed to get agent id by prod domain').toBe(CONSTANTS.DEPLOYED_AGENT_ID);
    });

    it('should get agent settings', async () => {
        const agentConnector = ConnectorService.getAgentDataConnector('Smyth');
        const agentSettings = await agentConnector.getAgentSettings(CONSTANTS.DEPLOYED_AGENT_ID);
        expect(agentSettings).toBeDefined();
        expect(agentSettings?.['settings_test_value']).toBe('value_is_set');
    });

    it('should identify if agent is deployed', async () => {
        const agentConnector = ConnectorService.getAgentDataConnector('Smyth');
        const isDeployed = await agentConnector.isDeployed(CONSTANTS.DEPLOYED_AGENT_ID);
        expect(isDeployed).toBe(true);

        const isDeployed2 = await agentConnector.isDeployed(CONSTANTS.UNDEPLOYED_AGENT_ID);
        expect(isDeployed2).toBe(false);
    });
});
