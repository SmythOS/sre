import { ConnectorService, ModelsProviderConnector, SmythRuntime } from '@sre/index';
import { vi } from 'vitest';

export function PrepareSRETestEnvironment() {
    const SREInstance = SmythRuntime.Instance.init({
        Storage: {
            Connector: 'Local',
        },
        Cache: {
            Connector: 'RAM',
        },
        AgentData: {
            Connector: 'Local',
            Settings: {
                devDir: './tests/data/AgentData',
                prodDir: './tests/data/AgentData',
            },
        },
        Account: {
            Connector: 'JSONFileAccount',
            Settings: {
                file: './tests/data/account.json',
            },
        },
        Vault: {
            Connector: 'JSONFileVault',
            Settings: {
                file: './tests/data/vault.json',
            },
        },
    });

    const modelsProvider: ModelsProviderConnector = ConnectorService.getModelsProviderConnector();

    const agentId = 'agent-123456';
    const MockAgentData = {
        id: agentId,
        agentRuntime: { debug: true }, // used inside createComponentLogger()
        isKilled: () => false,
        modelsProvider: modelsProvider.agent(agentId),
    };

    return { SREInstance, MockAgentData };
}
