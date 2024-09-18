import { LocalCache } from '@sre/helpers/LocalCache.helper';
import { Logger } from '../helpers/Log.helper';
import { createHash } from 'crypto';

const console = Logger('Connector');
const lCache = new LocalCache();
export class Connector {
    public name: string;
    public started = false;
    private _readyPromise: Promise<boolean>;

    constructor(config: any = {}) {}

    /**
     * Creates a new instance of the current class using the provided settings.
     * This method can be called on both Connector instances and its subclasses.
     *
     * @param config - Configuration settings for the new instance.
     * @returns A new instance of the current class.
     */
    public instance(config: any): this {
        const configHash = createHash('sha256').update(JSON.stringify(config)).digest('hex');
        const key = `${this.name}-${configHash}`;

        if (lCache.has(key)) {
            return lCache.get(key) as this;
        }

        // if not in cache, create a new instance from the concrete class
        const constructor = this.constructor as { new (config: any): any };
        const instance = new constructor(config);
        lCache.set(key, instance, 60 * 60 * 1000); // cache for 1 hour

        return instance;
    }

    public async start() {
        console.info(`Starting ${this.name} connector ...`);
        this.started = true;
    }

    public async stop() {
        console.info(`Stopping ${this.name} connector ...`);
    }

    public ready() {
        if (!this._readyPromise) {
            this._readyPromise = new Promise((resolve) => {
                let maxWait = 10000;
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
}
