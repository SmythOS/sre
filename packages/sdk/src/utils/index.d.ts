export declare class ControlledPromise<T> extends Promise<T> {
    private _isSettled;
    readonly isSettled: () => boolean;
    resolve: (value: T) => void;
    reject: (reason?: any) => void;
    constructor(executor: (resolve: (value: T) => void, reject: (reason?: any) => void, isSettled: () => boolean) => void);
}
export * from './general.utils';
export * from './console.utils';
