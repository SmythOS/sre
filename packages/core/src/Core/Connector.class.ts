import { createLogger } from './Logger';

const console = createLogger('Connector');

export abstract class Connector {
    public abstract name: string;
    public started = false;
    private _readyPromise: Promise<boolean>;

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
