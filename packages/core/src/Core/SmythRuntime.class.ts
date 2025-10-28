import { boot } from './boot';

import { SREConfig, TConnectorService } from '@sre/types/SRE.types';
import { Logger } from '../helpers/Log.helper';
import { ConnectorService } from './ConnectorsService';
import { SystemEvents } from './SystemEvents';
import { findSmythPath } from '../helpers/Sysconfig.helper';
import pkg from '../../package.json';

const logger = Logger('SRE');

export class SmythRuntime {
    public started = false;

    private _smythDir: string;
    public get smythDir() {
        return this._smythDir;
    }
    private _readyPromise: Promise<boolean>;
    private _readyResolve: (value: boolean) => void;

    public get version() {
        return pkg.version;
    }

    private defaultConfig: SREConfig = {
        Vault: {
            Connector: 'JSONFileVault',
            Settings: {
                shared: 'default', //default team shares its secrets with all other teams
            },
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
        Code: {
            Connector: 'DummyConnector',
        },
        //NKV should be loaded before VectorDB
        NKV: {
            Connector: 'LocalStorage',
        },
        VectorDB: {
            Connector: 'RAMVec',
        },
        ModelsProvider: {
            Connector: 'JSONModelsProvider',
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
        Scheduler: {
            Connector: 'LocalScheduler',
            Settings: {
                runJobs: true,
                persistExecutionHistory: true,
            },
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

    private _initializing = false;

    public get initializing() {
        return this._initializing;
    }

    private _initialized = false;

    public init(_config?: SREConfig): SmythRuntime {
        logger.info(`SRE v${this.version} initializing...`);
        if (!_config || JSON.stringify(_config) === '{}') {
            this._smythDir = findSmythPath();
            logger.info('.smyth directory found in:', this._smythDir);
        }

        if (this._initializing) {
            console.warn('You tried to initialize SRE while it is already initializing ... skipping');
            return;
        }
        if (this._initialized) {
            throw new Error('SRE already initialized');
        }
        this._initializing = true;
        SystemEvents.on('SRE:Booted', () => {
            this._readyResolve(true);
        });
        boot();

        const config = this.autoConf(_config);

        for (let connectorType in config) {
            for (let configEntry of config[connectorType]) {
                const connector = ConnectorService.init(
                    connectorType as TConnectorService,
                    configEntry.Connector,
                    configEntry.Id,
                    configEntry.Settings,
                    configEntry.Default
                );
                if (!connector) {
                    logger.warn(`Failed to initialize connector ${connectorType}:${configEntry.Id || configEntry.Connector}`);
                }
            }
        }

        this._initialized = true;
        SystemEvents.emit('SRE:Initialized', SmythRuntime.Instance);

        return SmythRuntime.Instance as SmythRuntime;
    }

    /**
     * This function tries to auto configure, or fixes the provided configuration
     *
     * FIXME: The current version does not actually auto configure SRE, it just fixes the provided configuration for now
     * TODO: Implement auto configuration based on present environment variables and auto-detected configs
     * @param config
     */
    private autoConf(config: SREConfig = {}) {
        // default config for missing connectors
        const defaultConfig = JSON.parse(JSON.stringify(this.defaultConfig));

        // for (let connectorType in defaultConfig) {
        //     if (!config[connectorType]) {
        //         config[connectorType] = defaultConfig[connectorType];
        //     }
        // }

        const keys = Object.keys({ ...defaultConfig, ...config });

        const newConfig: SREConfig = {};
        for (let connectorType of keys) {
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

    private _stopping = false;
    public async _stop() {
        if (this._stopping) {
            return;
        }
        this._stopping = true;
        logger.info('Sending Shutdown Signals To All Subsystems...');
        await ConnectorService._stop();
        SmythRuntime.instance = undefined;
        this.started = false;
    }
}

export const SRE = SmythRuntime.Instance;
let shuttingDown = false;

async function shutdown(reason) {
    if (!SmythRuntime.Instance.started) return;
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`Caught ${reason} ... Attempting graceful shutdown`);
    if (SmythRuntime.Instance) {
        try {
            await SmythRuntime.Instance._stop();
        } catch (err) {
            logger.error('Shutdown error:', err);
        }
    }
}

['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, async () => {
        await shutdown(signal);
        process.exit(0); // Required after async
    });
});

process.on('beforeExit', (code) => {
    shutdown('beforeExit');
});

process.on('exit', (code) => {
    logger.info(`Goodbye!`);
});

// process.on('uncaughtException', (err) => {

// });
