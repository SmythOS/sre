import { ControlledPromise } from '../utils';
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
export declare class SDKObject {
    private _eventEmitter;
    private _readyPromise;
    get ready(): ControlledPromise<any>;
    constructor();
    protected init(): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
    off(event: string, listener: (...args: any[]) => void): void;
    once(event: string, listener: (...args: any[]) => void): void;
    removeListener(event: string, listener: (...args: any[]) => void): void;
}
