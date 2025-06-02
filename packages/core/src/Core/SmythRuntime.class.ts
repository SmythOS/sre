import { boot } from './boot';

import { SREConfig, TConnectorService } from '@sre/types/SRE.types';
import { ConnectorService } from './ConnectorsService';
import { SystemEvents } from './SystemEvents';
import { Logger } from '../helpers/Log.helper';

const logger = Logger('SRE');

export class SmythRuntime {
    public started = false;

    private _readyPromise: Promise<boolean>;
    private _readyResolve: (value: boolean) => void;

    private defaultConfig: SREConfig = {
        Vault: {
            Connector: 'NullVault',
        },
        Account: {
            Connector: 'DummyAccount',
        },
        Cache: {
            Connector: 'RAM',
        },
        Storage: {
            Connector: 'LocalStorage',
        },

        //NKV should be loaded before VectorDB
        NKV: {
            Connector: 'RAM',
        },
        VectorDB: {
            Connector: 'RAM',
        },
        ModelsProvider: {
            Connector: 'SmythModelsProvider',
        },
        AgentData: {
            Connector: 'NullAgentData',
        },
        Component: {
            Connector: 'LocalComponent',
        },
        ManagedVault: {
            Connector: 'NullManagedVault',
        },
        Log: {
            Connector: 'ConsoleLog',
        },
        Router: {
            Connector: 'NullRouter',
        },
    };

    protected constructor() {
        this.started = true;
        this._readyPromise = new Promise((resolve) => {
            this._readyResolve = resolve;
        });
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
        SystemEvents.on('SRE:Booted', () => {
            this._readyResolve(true);
        });
        boot();

        this.initialized = true;

        const config = this.autoConf(_config);

        for (let connectorType in config) {
            for (let configEntry of config[connectorType]) {
                ConnectorService.init(
                    connectorType as TConnectorService,
                    configEntry.Connector,
                    configEntry.Id,
                    configEntry.Settings,
                    configEntry.Default,
                );
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
        // default config for missing connectors
        const defaultConfig = JSON.parse(JSON.stringify(this.defaultConfig));

        // for (let connectorType in defaultConfig) {
        //     if (!config[connectorType]) {
        //         config[connectorType] = defaultConfig[connectorType];
        //     }
        // }

        const newConfig: SREConfig = {};
        for (let connectorType in defaultConfig) {
            newConfig[connectorType] = [];

            let entry = config[connectorType] || defaultConfig[connectorType];
            if (!Array.isArray(entry)) {
                entry = [entry];
            }

            let hasDefault = false;
            for (let connector of entry) {
                if (!connector.Connector) {
                    logger.warn(`Missing Connector Name in ${connectorType} entry ... it will be ignored`);
                    continue;
                }
                if (connector.Default) {
                    if (hasDefault) {
                        logger.warn(`Entry ${connectorType} has more than one default Connector ... only the first one will be used`);
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

    public ready(): Promise<boolean> {
        return this._readyPromise;
    }

    public async _stop() {
        logger.info('Shutting Down SmythRuntime ...');
        ConnectorService._stop();
        SmythRuntime.instance = undefined;
        this.started = false;
    }
}

export const SRE = SmythRuntime.Instance;
