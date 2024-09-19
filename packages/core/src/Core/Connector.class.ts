import { Logger } from '../helpers/Log.helper';

const console = Logger('Connector');

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
        // Using 'this.constructor' to refer to the class of the current instance.
        // The 'as any' cast is necessary because TypeScript doesn't automatically
        // recognize that 'this.constructor' can be invoked with 'new'.
        const constructor = this.constructor as { new (config: any): any };
        return new constructor(config);
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
