import 'dotenv/config';
import winston from 'winston';
import Transport from 'winston-transport';
import { getFormattedStackTrace } from '../utils';
import config from '@sre/config';
import { EventEmitter } from 'events';
import { logLevel } from './logLevel.helper';
winston.addColors({
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
});


// Retrieve the DEBUG environment variable and split it into an array of namespaces
const namespaces = (config.env.LOG_FILTER || '').split(',');

// Create a Winston format that filters messages based on namespaces
const namespaceFilter = winston.format((info: any) => {
    // If DEBUG is not set, log everything
    if (!config.env.LOG_FILTER || namespaces.some((ns) => info.module?.includes(ns))) {
        return info;
    }
    return false; // Filter out messages that do not match the namespace
})();

// Custom stream for your transport
class ArrayTransport extends Transport {
    private logs: any[];
    constructor(opts) {
        super(opts);
        // Configure your storage array
        this.logs = opts.logs;
    }

    log(info, callback) {
        setImmediate(() => {
            this.emit('logged', info);
        });

        // Perform the writing to the array storage
        this.logs.push(`${info.level}: ${info.message}`);

        // Perform the writing to the remote service
        callback();
    }
}

export class LogHelper extends EventEmitter {
    public startTime = Date.now();
    public get output() {
        return Array.isArray(this.data) ? this.data.join('\n') : undefined;
    }
    public get elapsedTime() {
        return Date.now() - this.startTime;
    }
    constructor(
        private _logger: winston.Logger,
        public data,
        private labels: { [key: string]: any },
    ) {
        super();
    }

    public log(...args) {
        this._logger.log('info', formatLogMessage(...args), this.labels);
        this.emit('logged', { level: 'info', message: formatLogMessage(...args) });
    }
    public warn(...args) {
        this._logger.log('warn', formatLogMessage(...args), this.labels);
        this.emit('logged', { level: 'warn', message: formatLogMessage(...args) });
    }
    public debug(...args) {
        this._logger.log('debug', formatLogMessage(...args), this.labels);
        this.emit('logged', { level: 'debug', message: formatLogMessage(...args) });
    }
    public info(...args) {
        this._logger.log('info', formatLogMessage(...args), this.labels);
        this.emit('logged', { level: 'info', message: formatLogMessage(...args) });
    }
    public verbose(...args) {
        this._logger.log('verbose', formatLogMessage(...args), this.labels);
        this.emit('logged', { level: 'verbose', message: formatLogMessage(...args) });
    }

    public error(...args) {
        const stack = '\nCall Stack:\n' + getFormattedStackTrace(10).join('\n');

        this._logger.log('error', formatLogMessage(...args), { ...this.labels, stack });

        this.emit('logged', { level: 'error', message: formatLogMessage(...args) });
    }

    public close() {
        this._logger.clear();
        this._logger.close();
    }
}

const colorizedFormat = winston.format.printf((info) => {
    return `${info.timestamp} ${winston.format.colorize().colorize(info.level, `${info.level}: ${info.message}`)}`;
});

const MAX_LOG_MESSAGE_LENGTH = 500;

function redactLogMessage(logMessage: string) {
    if (config.env.NODE_ENV !== 'PROD') return logMessage; //only redact logs in PROD
    if (logMessage.length > 500) {
        return logMessage;
    }

    const sensitiveWords = ['password', 'eyJ', 'token', 'email', 'secret', 'key', 'apikey', 'api_key', 'auth', 'credential'];
    const obfuscatedString = ' [!! SmythOS::REDACTED_DATA !!] ';

    // Iterate through the sensitive words list and replace sensitive data in the log message

    for (const sensitiveWord of sensitiveWords) {
        // Create a regular expression to find the sensitive word followed by any character (non-greedy) until a space, newline, or separator is found.
        const regex = new RegExp(`(${sensitiveWord})((?:[^\\n]{0,29}(?=\\n))|(?:[^\\n]{30}\\S*))`, 'gmi');

        // Replace sensitive data with the obfuscated string
        logMessage = logMessage.replace(regex, `$1${obfuscatedString}`);
    }

    return logMessage;
}

function createBaseLogger(memoryStore?: any[]) {
    const logger = winston.createLogger({
        //level: 'info', // log level

        format: winston.format.combine(
            winston.format((info: any) => {
                if (config.env.LOG_LEVEL == 'none' || logLevel() == 'none' || logLevel() == '') return false; // skip logging if log level is none

                // Apply redaction to the log message
                //info.message = redactSecrets(info.message, sensitiveOptions);

                info.message = redactLogMessage(info.message);
                return info;
            })(),
            winston.format.timestamp(),
            winston.format.errors({
                stack: true,
            }),
            winston.format.splat(),
            winston.format.json(),
        ),

        transports: [
            new winston.transports.Console({
                level: 'error',
                //handleExceptions: true,
                format: winston.format.combine(
                    winston.format.printf((info: any) => {
                        let message = info.message;
                        message = message?.length > MAX_LOG_MESSAGE_LENGTH ? message.substring(0, MAX_LOG_MESSAGE_LENGTH) + '...' : message;
                        return `${info.level}:${info.module || ''} ${message} ${info.stack || ''}`;
                    }),
                ),
                stderrLevels: ['error'], // Define levels that should be logged to stderr
            }),
            new winston.transports.Console({
                level: logLevel(),
                format: winston.format.combine(
                    namespaceFilter,
                    winston.format.printf((info: any) => {
                        const module = info.module ? winston.format.colorize().colorize(info.level, ` [${info.module}]`) : '';
                        const ns = winston.format.colorize().colorize(info.level, `${info.level}${module}`);

                        let message = info.message;
                        message = message?.length > MAX_LOG_MESSAGE_LENGTH ? message.substring(0, MAX_LOG_MESSAGE_LENGTH) + '...' : message;

                        return `${ns} - ${message}`;
                    }),
                ),

                //handleExceptions: true,
            }),
        ],
    });

    if (Array.isArray(memoryStore)) {
        logger.add(
            new ArrayTransport({
                level: 'debug',
                logs: memoryStore,
            }),
        );
    }

    return logger;
}

function formatLogMessage(...args) {
    return args
        .map((arg) => {
            // If the argument is an object (and not null), serialize it to JSON
            if (typeof arg === 'object' && arg !== null && !(arg instanceof Error)) {
                try {
                    return JSON.stringify(arg, null, 2); // set the space to 2 for better readability
                } catch (error) {
                    return String(arg);
                }
            }
            // Otherwise, just convert it to a string in case it's not
            return String(arg);
        })
        .join(' '); // Concatenate all arguments with a space
}

function createLabeledLogger(labels: { [key: string]: any }, memoryStore?: any[]) {
    const _logger = createBaseLogger(memoryStore);

    _logger.defaultMeta = labels;

    const logger = new LogHelper(_logger, memoryStore, labels);

    return logger;
}

export function Logger(module: string, withMemoryStore = false) {
    return createLabeledLogger({ module }, withMemoryStore ? [] : undefined);
}
