import { LocalCache } from '@sre/helpers/LocalCache.helper';
import { Logger } from '../helpers/Log.helper';
import { createHash } from 'crypto';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

const logger = Logger('Connector');
//const lCache = new LocalCache();

export class Connector<TRequest = any> {
    public name: string;
    public started = false;
    private _interactionHandler: () => void;
    private _readyPromise: Promise<boolean>;
    private static lCache = new LocalCache();

    public get settings() {
        return this._settings;
    }

    public get interactionHandler() {
        return this._interactionHandler;
    }

    //this flag is used to check if the connector is valid
    //when a connector fails to load, it is replaced by a DummyConnector instance which returns false for this flag
    public get valid() {
        return true;
    }

    constructor(protected _settings?: any) {
        //TODO : check if smyth runtime is initialized and throw an error if it is not
    }

    /**
     * If the connector is interactive, The connector initializer will wait for start() method to complete before loading the next connector
     */
    protected setInteraction(handler: () => void) {
        this._interactionHandler = handler;
    }
    /**
     * Creates a new instance of the current class using the provided settings.
     * This method can be called on both Connector instances and its subclasses.
     * This is used when we need to create a connector instance with a specific configuration (for example with user provided keys)
     *
     * @param settings - Configuration settings for the new instance.
     * @returns A new instance of the current class.
     */
    public instance(settings: any): this {
        const configHash = createHash('sha256')
            .update(JSON.stringify(settings || {}))
            .digest('hex');
        const key = `${this.name}-${configHash}`;

        if (Connector.lCache.has(key)) {
            return Connector.lCache.get(key) as this;
        }

        // if not in cache, create a new instance from the concrete class
        const constructor = this.constructor as { new (config: any): any };
        const instance = new constructor(settings);
        Connector.lCache.set(key, instance, 60 * 60 * 1000); // cache for 1 hour

        return instance;
    }

    static isValid(connector: Connector): boolean {
        return connector.name !== undefined && connector.name !== null && connector.name !== '';
    }

    public async start() {
        logger.info(`Starting ${this.name} connector ...`);
        this.started = true;
    }

    public async stop() {
        logger.info(`Stopping ${this.name} connector ...`);
    }

    public ready() {
        if (!this._readyPromise) {
            this._readyPromise = new Promise((resolve) => {
                let maxWait = 60000;
                const tick = 100;
                if (this.started) {
                    resolve(true);
                } else {
                    const interval = setInterval(() => {
                        if (this.started) {
                            clearInterval(interval);
                            resolve(true);
                        }

                        maxWait -= tick;
                        if (maxWait <= 0) {
                            clearInterval(interval);
                            resolve(false);
                        }
                    }, tick);
                }
            });
        }
        return this._readyPromise;
    }

    public requester(candidate: AccessCandidate): TRequest {
        return null as TRequest;
    }

    public user(candidate: AccessCandidate | string): TRequest {
        if (typeof candidate === 'string') {
            return this.requester(AccessCandidate.user(candidate));
        }

        //backward compatibility
        //this will be deprecated in the future, use .requester for this case
        // .user will only accept strings representing the user id
        return this.requester(candidate);
    }

    public team(teamId: string): TRequest {
        return this.requester(AccessCandidate.team(teamId));
    }

    public agent(agentId: string): TRequest {
        return this.requester(AccessCandidate.agent(agentId));
    }

    public handleEvent(eventName: string, data: any): void {
        logger.debug(`Connector ${this.name} received event ${eventName} `);
    }
}
