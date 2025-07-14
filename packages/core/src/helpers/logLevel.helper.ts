import { parseCLIArgs } from '../utils';
import config from '@sre/config';

const logLevelMap = {
    min: 'info',
    full: 'debug',
};

export function logLevel() {
    let val = parseCLIArgs('debug')?.debug || config?.env?.LOG_LEVEL || 'none';
    if (logLevelMap[val as keyof typeof logLevelMap]) val = logLevelMap[val as keyof typeof logLevelMap];
    return !['none', 'error', 'warn', 'info', 'debug'].includes(val) ? 'none' : val;
}
