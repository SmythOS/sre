import { SREConnectorConfig, TConnectorService, TServiceRegistry } from '@sre/types/SRE.types';
import { DummyConnector } from './DummyConnector';
import { Logger } from '../helpers/Log.helper';
import { Connector } from './Connector.class';
import { getFormattedStackTrace, isSubclassOf, printStackTrace } from '@sre/utils';
import { SystemEvents } from './SystemEvents';
import { StorageConnector } from '@sre/IO/Storage.service/StorageConnector';
import { CacheConnector } from '@sre/MemoryManager/Cache.service/CacheConnector';
import { LLMConnector } from '@sre/LLMManager/LLM.service/LLMConnector';
import { VaultConnector } from '@sre/Security/Vault.service/VaultConnector';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { AgentDataConnector } from '@sre/AgentManager/AgentData.service/AgentDataConnector';
import { VectorDBConnector } from '@sre/IO/VectorDB.service/VectorDBConnector';
import { CLIConnector } from '@sre/IO/CLI.service/CLIConnector';
import { NKVConnector } from '@sre/IO/NKV.service/NKVConnector';
import { RouterConnector } from '@sre/IO/Router.service/RouterConnector';
import { ManagedVaultConnector } from '@sre/Security/ManagedVault.service/ManagedVaultConnector';
import { LogConnector } from '@sre/IO/Log.service/LogConnector';
import { ComponentConnector } from '@sre/AgentManager/Component.service/ComponentConnector';
import { ModelsProviderConnector } from '@sre/LLMManager/ModelsProvider.service/ModelsProviderConnector';
const console = Logger('ConnectorService');

let ServiceRegistry: TServiceRegistry = {};
let _ready = false;
SystemEvents.on('SRE:Booted', (services) => {
    ServiceRegistry = services;
    _ready = true;
});
export class ConnectorService {
    public static Connectors = {};

    public static ConnectorInstances: any = {};
    public static get ready() {
        return _ready;
    }

    public static get service(): TServiceRegistry {
        return ServiceRegistry;
    }
    /**
     * Allows SRE services to register their connectors, a registered conector can then be initialized and used by SRE or its services
     * @param connectorType
     * @param connectorName
     * @param connectorConstructor
     * @returns
     */
    static register(connectorType: TConnectorService, connectorName: string, connectorConstructor: any) {
        if (typeof connectorConstructor !== 'function' || !isSubclassOf(connectorConstructor, Connector)) {
            console.error(`Invalid Connector ${connectorType}:${connectorName}`);
            return;
        }
        if (!ConnectorService.Connectors[connectorType]) {
            ConnectorService.Connectors[connectorType] = {};
        }
        ConnectorService.Connectors[connectorType][connectorName] = connectorConstructor;
    }

    /**
     * The init method instantiates a connector and starts it, a connector cannot be used before it is initialized
     * Usually the initialization phase happens during the SRE startup, but some connectors can be initialized later if they are not mandatory for the SRE to start
     *
     *
     * @param connectorType
     * @param connectorName
     * @param settings
     * @param isDefault
     * @returns
     */
    static init(connectorType: TConnectorService, connectorName: string, connectorId?: string, settings: any = {}, isDefault = false) {
        if (ConnectorService.ConnectorInstances[connectorType]?.[connectorName]) {
            throw new Error(`Connector ${connectorType}:${connectorName} already initialized`);
        }

        const entry = ConnectorService.Connectors[connectorType];
        if (!entry) return;
        const connectorConstructor = entry[connectorName];

        if (connectorConstructor) {
            const connector: Connector = new connectorConstructor(settings);
            if (connector.interactionHandler) {
                connector.interactionHandler();
            }

            connector.start();
            if (!ConnectorService.ConnectorInstances[connectorType]) ConnectorService.ConnectorInstances[connectorType] = {};
            const id = connectorId || connectorName;
            ConnectorService.ConnectorInstances[connectorType][id] = connector;

            if (!ConnectorService.ConnectorInstances[connectorType].default && isDefault) {
                ConnectorService.ConnectorInstances[connectorType].default = connector;
            }

            return connector;
        }
    }
    static async _stop() {
        for (let connectorName in ConnectorService.ConnectorInstances) {
            let allConnectors: Connector[] = Object.values(ConnectorService.ConnectorInstances[connectorName]);
            //deduplicate
            allConnectors = allConnectors.filter((value, index, self) => self.indexOf(value) === index);
            for (let connector of allConnectors) {
                connector.stop();
            }
        }
    }
    static getInstance<T>(connectorType: TConnectorService, connectorName: string = 'default'): T {
        const instance = ConnectorService.ConnectorInstances[connectorType]?.[connectorName || 'default'] as T;
        if (!instance) {
            //TODO only apply the fallback below if resilient mode is enabled
            // if (ConnectorService.ConnectorInstances[connectorType] && Object.keys(ConnectorService.ConnectorInstances[connectorType]).length > 0) {
            //     //return the first instance
            //     return ConnectorService.ConnectorInstances[connectorType][Object.keys(ConnectorService.ConnectorInstances[connectorType])[0]] as T;
            // }
            console.warn(`Connector ${connectorType}:${connectorName} not initialized returning DummyConnector`);
            //print stack trace

            printStackTrace(console, 5);

            return DummyConnector(connectorType) as T;
        }
        return instance;
    }

    static getStorageConnector(name?: string): StorageConnector {
        return ConnectorService.getInstance<StorageConnector>(TConnectorService.Storage, name);
    }

    static getCacheConnector(name?: string): CacheConnector {
        return ConnectorService.getInstance<any>(TConnectorService.Cache, name);
    }

    static getVectorDBConnector(name?: string): VectorDBConnector {
        return ConnectorService.getInstance<VectorDBConnector>(TConnectorService.VectorDB, name);
    }

    static getNKVConnector(name?: string): NKVConnector {
        return ConnectorService.getInstance<NKVConnector>(TConnectorService.NKV, name);
    }

    static getLLMConnector(name?: string): LLMConnector {
        return ConnectorService.getInstance<LLMConnector>(TConnectorService.LLM, name);
    }

    static getVaultConnector(name?: string): VaultConnector {
        return ConnectorService.getInstance<VaultConnector>(TConnectorService.Vault, name);
    }

    static getManagedVaultConnector(name?: string): ManagedVaultConnector {
        return ConnectorService.getInstance<ManagedVaultConnector>(TConnectorService.ManagedVault, name);
    }

    static getAccountConnector(name?: string): AccountConnector {
        return ConnectorService.getInstance<AccountConnector>(TConnectorService.Account, name);
    }

    static getAgentDataConnector(name?: string): AgentDataConnector {
        return ConnectorService.getInstance<AgentDataConnector>(TConnectorService.AgentData, name);
    }

    static getCLIConnector(name?: string): CLIConnector {
        return ConnectorService.getInstance<CLIConnector>(TConnectorService.CLI, name);
    }

    static getLogConnector(name?: string): LogConnector {
        return ConnectorService.getInstance<LogConnector>(TConnectorService.Log, name);
    }

    static getComponentConnector(name?: string): ComponentConnector {
        return ConnectorService.getInstance<ComponentConnector>(TConnectorService.Component, name);
    }

    static getModelsProviderConnector(name?: string): ModelsProviderConnector {
        return ConnectorService.getInstance<ModelsProviderConnector>(TConnectorService.ModelsProvider, name);
    }

    static hasInstance(connectorType: TConnectorService, connectorName: string = 'default') {
        const instance = ConnectorService.ConnectorInstances[connectorType]?.[connectorName];
        return instance && instance.valid;
    }

    static getRouterConnector(name?: string): RouterConnector {
        return ConnectorService.getInstance<RouterConnector>(TConnectorService.Router, name);
    }

    static getCodeConnector(name?: string): RouterConnector {
        return ConnectorService.getInstance<RouterConnector>(TConnectorService.Code, name);
    }
}

export abstract class ConnectorServiceProvider {
    public abstract register();
    public init() {}
    public constructor() {
        this.register();
    }
}
