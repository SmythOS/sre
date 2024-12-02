import { SREConnectorConfig, TConnectorService, TServiceRegistry } from '@sre/types/SRE.types';
import { DummyConnector } from './DummyConnector';
import { Logger } from '../helpers/Log.helper';
import { Connector } from './Connector.class';
import { isSubclassOf } from '@sre/utils';
import SystemEvents from './SystemEvents';
import { StorageConnector } from '@sre/IO/Storage.service/StorageConnector';
import { CacheConnector } from '@sre/MemoryManager/Cache.service';
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
const console = Logger('ConnectorService');

const Connectors = {};

const ConnectorInstances: any = {};
let ServiceRegistry: TServiceRegistry = {};
let _ready = false;
SystemEvents.on('SRE:Booted', (services) => {
    ServiceRegistry = services;
    _ready = true;
});
export class ConnectorService {
    //Singleton
    // private constructor() {
    //     SystemEvents.on('SRE:Booted', (services) => {
    //         ServiceRegistry = services;
    //     });
    // }
    // private static instance: ConnectorService;
    // public static get Instance(): ConnectorService {
    //     if (!ConnectorService.instance) {
    //         ConnectorService.instance = new ConnectorService();
    //     }
    //     return ConnectorService.instance;
    // }
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
        if (!Connectors[connectorType]) {
            Connectors[connectorType] = {};
        }
        Connectors[connectorType][connectorName] = connectorConstructor;
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
        if (ConnectorInstances[connectorType]?.[connectorName]) {
            throw new Error(`Connector ${connectorType}:${connectorName} already initialized`);
        }

        const entry = Connectors[connectorType];
        if (!entry) return;
        const connectorConstructor = entry[connectorName];

        if (connectorConstructor) {
            const connector: Connector = new connectorConstructor(settings);

            connector.start();
            if (!ConnectorInstances[connectorType]) ConnectorInstances[connectorType] = {};
            const id = connectorId || connectorName;
            ConnectorInstances[connectorType][id] = connector;

            if (!ConnectorInstances[connectorType].default && isDefault) {
                ConnectorInstances[connectorType].default = connector;
            }
        }
    }
    static async _stop() {
        for (let connectorName in ConnectorInstances) {
            let allConnectors: Connector[] = Object.values(ConnectorInstances[connectorName]);
            //deduplicate
            allConnectors = allConnectors.filter((value, index, self) => self.indexOf(value) === index);
            for (let connector of allConnectors) {
                connector.stop();
            }
        }
    }
    static getInstance<T>(connectorType: TConnectorService, connectorName: string = 'default'): T {
        const instance = ConnectorInstances[connectorType]?.[connectorName] as T;
        if (!instance) {
            if (ConnectorInstances[connectorType] && Object.keys(ConnectorInstances[connectorType]).length > 0) {
                //return the first instance
                return ConnectorInstances[connectorType][Object.keys(ConnectorInstances[connectorType])[0]] as T;
            }
            console.warn(`Connector ${connectorType} not initialized returning DummyConnector`);
            //print stack trace
            console.debug(new Error().stack);
            return DummyConnector as T;
        }
        return instance;
    }

    // Storage?: StorageService;
    // Cache?: CacheService;
    // LLM?: LLMService;
    // Vault?: VaultService;
    // Account?: AccountService;

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

    //TODO: add missing get<Connector> functions : e.g getAgentData(), getCache() etc ...

    static hasInstance(connectorType: TConnectorService, connectorName: string = 'default') {
        const instance = ConnectorInstances[connectorType]?.[connectorName];
        return instance && instance !== DummyConnector;
    }

    static getRouterConnector(name?: string): RouterConnector {
        return ConnectorService.getInstance<RouterConnector>(TConnectorService.Router, name);
    }
}

export abstract class ConnectorServiceProvider {
    public abstract register();
    public init() {}
    public constructor() {
        this.register();
    }
}
