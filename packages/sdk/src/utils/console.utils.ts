export const SDKLog = {
    warn: (...args: any[]) => {
        console.warn('[WARN]', ...args);
    },
    error: (...args: any[]) => {
        console.error('[ERR]', ...args);
    },
    info: (...args: any[]) => {
        console.info('[INFO]', ...args);
    },
    debug: (...args: any[]) => {
        console.debug('[DBG]', ...args);
    },
    log: (...args: any[]) => {
        console.log(...args);
    },
};
