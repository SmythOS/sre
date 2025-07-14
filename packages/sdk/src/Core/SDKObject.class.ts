import { EventEmitter } from 'events';
import { ControlledPromise } from '../utils';
import { SRE } from '@smythos/sre';

/**
 * Base class for all SDK objects.
 *
 * This class provides a base implementation for all SDK objects.
 * It handles event emission, promise management, and initialization.
 *
 * This object is used to ensure that an SRE instance is initialized, and if not, create one with default settings.
 *
 * @abstract
 */
export class SDKObject {
    private _eventEmitter: EventEmitter;
    private _readyPromise: ControlledPromise<any>;

    public get ready() {
        return this._readyPromise;
    }

    constructor() {
        this._eventEmitter = new EventEmitter();

        //init the SRE instance and wait for it to be ready
        this._readyPromise = new ControlledPromise<any>(this.init.bind(this));
    }

    protected async init() {
        //if the SRE instance is not initializing, initialize it with default settings
        if (!SRE.initializing) SRE.init({});
        await SRE.ready();

        this._readyPromise.resolve(true);
    }

    on(event: string, listener: (...args: any[]) => void) {
        this._eventEmitter.on(event, listener);
    }

    emit(event: string, ...args: any[]) {
        this._eventEmitter.emit(event, ...args);
    }

    off(event: string, listener: (...args: any[]) => void) {
        this._eventEmitter.off(event, listener);
    }

    once(event: string, listener: (...args: any[]) => void) {
        this._eventEmitter.once(event, listener);
    }
    removeListener(event: string, listener: (...args: any[]) => void) {
        this._eventEmitter.removeListener(event, listener);
    }

    // removeAllListeners(event?: string) {
    //     this._eventEmitter.removeAllListeners(event);
    // }
}
