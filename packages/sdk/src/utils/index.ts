export class ControlledPromise<T> extends Promise<T> {
    private _isSettled = false;
    public readonly isSettled: () => boolean;
    public resolve!: (value: T) => void;
    public reject!: (reason?: any) => void;

    constructor(executor: (resolve: (value: T) => void, reject: (reason?: any) => void, isSettled: () => boolean) => void) {
        let internalResolve!: (value: T) => void;
        let internalReject!: (reason?: any) => void;
        let _isSettled = false;

        super((resolve, reject) => {
            internalResolve = (value: T) => {
                if (!_isSettled) {
                    _isSettled = true;
                    resolve(value);
                }
            };

            internalReject = (reason?: any) => {
                if (!_isSettled) {
                    _isSettled = true;
                    reject(reason);
                }
            };
        });

        this.resolve = internalResolve;
        this.reject = internalReject;
        this.isSettled = () => _isSettled;

        // run user executor with the third isSettled arg
        executor(this.resolve, this.reject, this.isSettled);
    }
}

export * from './general.utils';
export * from './console.utils';
export * from './jsonSafe';
export * from './structuredOutput';
export * from './retry';
