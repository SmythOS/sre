import { boot } from './boot';

import { SREConfig, TConnectorService } from '@sre/types/SRE.types';
import { ConnectorService } from './ConnectorsService';
import { SystemEvents } from './SystemEvents';
import { Logger } from '../helpers/Log.helper';

const logger = Logger('SRE');
const CInstance = ConnectorService;

export class SmythRuntime {
    public started = false;

    private _readyPromise: Promise<boolean>;
    private _readyResolve: (value: boolean) => void;

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
                CInstance.init(connectorType as TConnectorService, configEntry.Connector, configEntry.Id, configEntry.Settings, configEntry.Default);
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
        const defaultConfig = {
            ModelsProvider: {
                Connector: 'SmythModelsProvider',
            },
        };

        for (let connectorType in defaultConfig) {
            if (!config[connectorType]) {
                config[connectorType] = defaultConfig[connectorType];
            }
        }

        const newConfig: SREConfig = {};
        for (let connectorType in config) {
            newConfig[connectorType] = [];
            if (!Array.isArray(config[connectorType])) {
                config[connectorType] = [config[connectorType]];
            }

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

    public ready(): Promise<boolean> {
        return this._readyPromise;
    }

    public async _stop() {
        logger.info('Shutting Down SmythRuntime ...');
        CInstance._stop();
        SmythRuntime.instance = undefined;
        this.started = false;
    }
}
