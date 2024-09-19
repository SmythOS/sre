import { SREConfig, TConnectorService } from '@sre/types/SRE.types';
import { ConnectorService } from './ConnectorsService';
import SystemEvents from './SystemEvents';
import { Logger } from '../helpers/Log.helper';
import { RouterConnector } from '@sre/IO/Router.service/RouterConnector';

const logger = Logger('SRE');
const CInstance = ConnectorService;

interface IRouter {
    get(path: string, ...handlers: Function[]): this;
    post(path: string, ...handlers: Function[]): this;
    put(path: string, ...handlers: Function[]): this;
    delete(path: string, ...handlers: Function[]): this;
    use(...handlers: Function[]): this;
    use(path: string, ...handlers: Function[]): this;
}

export default class SmythRuntime {
    public started = false;

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

    public async _stop() {
        logger.info('Shutting Down SmythRuntime ...');
        CInstance._stop();
        SmythRuntime.instance = undefined;
        this.started = false;
    }
}
