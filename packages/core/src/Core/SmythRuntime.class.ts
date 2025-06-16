import { boot } from './boot';

import { SREConfig, TConnectorService } from '@sre/types/SRE.types';
import { ConnectorService } from './ConnectorsService';
import { SystemEvents } from './SystemEvents';
import { Logger } from '../helpers/Log.helper';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const logger = Logger('SRE');

export class SmythRuntime {
    public started = false;

    private _smythDir: string;
    public get smythDir() {
        return this._smythDir;
    }
    private _readyPromise: Promise<boolean>;
    private _readyResolve: (value: boolean) => void;

    private defaultConfig: SREConfig = {
        Vault: {
            Connector: 'JSONFileVault',
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
            Connector: 'RAM',
        },
        VectorDB: {
            Connector: 'RAMVec',
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

    private _initializing = false;

    public get initializing() {
        return this._initializing;
    }

    private _initialized = false;

    public init(_config?: SREConfig): SmythRuntime {
        if (!_config || JSON.stringify(_config) === '{}') {
            this._smythDir = findSmythDir();
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
                ConnectorService.init(
                    connectorType as TConnectorService,
                    configEntry.Connector,
                    configEntry.Id,
                    configEntry.Settings,
                    configEntry.Default
                );
            }
        }

        this._initialized = true;
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

function findSmythDir() {
    // 1. Try to find in local directory (the directory from which the program was run)
    const localDir = path.resolve(process.cwd(), '.smyth');
    if (fs.existsSync(localDir)) {
        return localDir;
    }

    // 2. Try to find from main script's directory (entry point)
    const mainScriptPath = process.argv[1];
    const mainScriptDir = path.dirname(path.resolve(mainScriptPath));
    if (mainScriptPath) {
        const mainScriptSmythDir = path.resolve(mainScriptDir, '.smyth');
        if (fs.existsSync(mainScriptSmythDir)) {
            return mainScriptSmythDir;
        }
    }

    // 3. Try to find it in current package root directory (where package.json is)
    let packageRootDir = findPackageRoot();
    if (packageRootDir) {
        const packageSmythDir = path.resolve(packageRootDir, '.smyth');
        if (fs.existsSync(packageSmythDir)) {
            return packageSmythDir;
        }
    }

    // 4. Try to find it in current package root directory from main script's directory
    packageRootDir = findPackageRoot(mainScriptDir);
    if (packageRootDir) {
        const packageSmythDir = path.resolve(packageRootDir, '.smyth');
        if (fs.existsSync(packageSmythDir)) {
            return packageSmythDir;
        }
    }

    // 5. Try to find it in user home directory
    const homeDir = path.resolve(os.homedir(), '.smyth');
    if (fs.existsSync(homeDir)) {
        return homeDir;
    }

    // Default: return path in current working directory (will be created if needed)
    return localDir;
}

function findPackageRoot(startDir = process.cwd()) {
    let currentDir = startDir;

    while (currentDir !== path.dirname(currentDir)) {
        const packageJsonPath = path.resolve(currentDir, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            return currentDir;
        }
        currentDir = path.dirname(currentDir);
    }

    return null;
}

async function shutdown(reason) {
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
