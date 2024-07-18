import Agent from '@sre/AgentManager/Agent.class';
import AgentRequest from '@sre/AgentManager/AgentRequest.class';
import AgentSettings from '@sre/AgentManager/AgentSettings.class';
//import { StorageConnector } from '@sre/IO/Storage.service/StorageConnector';
//import { IAgentDataConnector } from '@sre/AgentManager/AgentData.service/AgentDataConnector';
//import { ICacheConnector } from '@sre/MemoryManager/Cache.service/ICacheConnector';
import { SREConfig, TConnectorService, TServiceRegistry } from '@sre/types/SRE.types';
import { ConnectorService } from './ConnectorsService';
import SystemEvents from './SystemEvents';
//import { VaultConnector } from '@sre/Security/Vault.service/VaultConnector';

//const CInstance = ConnectorService.Instance;
const CInstance = ConnectorService;

export default class SmythRuntime {
    //protected static _instances: any = {};

    public started = false;
    //protected static _agentDataProviderInstance: IAgentDataConnector;

    //Moved to connectorSerive
    // public get Storage(): StorageConnector {
    //     return CInstance.getInstance<StorageConnector>(TConnectorService.Storage);
    // }
    // public get Cache(): ICacheConnector {
    //     return CInstance.getInstance<ICacheConnector>(TConnectorService.Cache);
    // }
    // public get AgentData(): IAgentDataConnector {
    //     return CInstance.getInstance<IAgentDataConnector>(TConnectorService.AgentData);
    // }

    // public get Vault(): VaultConnector {
    //     return CInstance.getInstance<VaultConnector>(TConnectorService.Vault);
    // }
    protected constructor() {
        this.started = true;
    }

    protected static instance?: SmythRuntime;
    public static get Instance(): SmythRuntime {
        if (!SmythRuntime.instance) {
            SmythRuntime.instance = new SmythRuntime();
        }
        return SmythRuntime.instance;
    }

    private initialized = false;
    public init(_config: SREConfig): SmythRuntime {
        if (this.initialized) {
            throw new Error('SRE already initialized');
        }
        this.initialized = true;

        const config = this.autoConf(_config);

        for (let connectorType in config) {
            for (let configEntry of config[connectorType]) {
                CInstance.init(connectorType as TConnectorService, configEntry.Connector, configEntry.Settings, configEntry.Default);
            }
        }

        SystemEvents.emit('SRE:Initialized');
        return SmythRuntime.Instance as SmythRuntime;
    }

    /**
     * This function tries to auto configure, or fixes the provided configuration
     *
     * FIXME: The current version does not actually auto configure SRE, it just fixes the provided configuration for now
     * TODO: Implement auto configuration based on present environment variables and auto-detected configs
     * @param config
     */
    private autoConf(config: SREConfig) {
        const newConfig: SREConfig = {};
        for (let connectorType in config) {
            newConfig[connectorType] = [];
            if (typeof config[connectorType] === 'object') config[connectorType] = [config[connectorType]];

            let hasDefault = false;
            for (let connector of config[connectorType]) {
                if (!connector.Connector) {
                    console.warn(`Missing Connector Name in ${connectorType} entry ... it will be ignored`);
                    continue;
                }
                if (connector.Default) {
                    if (hasDefault) {
                        console.warn(`Entry ${connectorType} has more than one default Connector ... only the first one will be used`);
                    }
                    hasDefault = true;
                }
                newConfig[connectorType].push(connector);
            }

            if (!hasDefault && newConfig[connectorType].length > 0) {
                newConfig[connectorType][0].Default = true;
            }
        }

        return newConfig;
    }

    public ready(): boolean {
        return this.initialized;
    }

    // async runAgent(id, JSONData, request: AgentRequest) {
    //     try {
    //         const agentData = JSONData;

    //         const pathMatches = request.path.match(/(^\/v[0-9]+\.[0-9]+?)?(\/api\/(.+)?)/);
    //         if (!pathMatches || !pathMatches[2]) {
    //             return { status: 404, data: { error: 'Endpoint not found' } };
    //         }
    //         const endpointPath = pathMatches[2];
    //         const input = request.method == 'GET' ? request.query : request.body;

    //         const agentSettings = new AgentSettings(id);

    //         const agent = new Agent(id, agentData, agentSettings, request);
    //         const result: any = await agent.process(endpointPath, input).catch((error) => ({ error: error.message }));

    //         return result;
    //     } catch (error) {
    //         console.error('Error running agent', error.message);
    //         return { error: 'Error running agent' };
    //     }
    // }

    public async _stop() {
        console.info('Shutting Down SmythRuntime ...');
        CInstance._stop();
        SmythRuntime.instance = undefined;
        this.started = false;
    }
}
