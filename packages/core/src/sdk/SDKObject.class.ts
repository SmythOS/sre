import { EventEmitter } from 'events';
import { ControlledPromise } from '../utils';
import { SRE } from '@sre/Core/SmythRuntime.class';

export class SDKObject {
    private _eventEmitter: EventEmitter;
    private _readyPromise: ControlledPromise<any>;

    public get ready() {
        return this._readyPromise;
    }

    constructor() {
        this._eventEmitter = new EventEmitter();
        this._readyPromise = new ControlledPromise<any>(this.init.bind(this));
    }

    protected async init() {
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

    // removeAllListeners(event?: string) {
    //     this._eventEmitter.removeAllListeners(event);
    // }
}
