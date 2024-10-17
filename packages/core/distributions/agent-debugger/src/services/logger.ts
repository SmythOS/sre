import 'dotenv/config';
import winston from 'winston';
import Transport from 'winston-transport';

winston.addColors({
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
});

// Retrieve the DEBUG environment variable and split it into an array of namespaces
const namespaces = (process.env.LOG_FILTER || '').split(',');

// Create a Winston format that filters messages based on namespaces
const namespaceFilter = winston.format((info) => {
    // If DEBUG is not set, log everything
    if (!process.env.LOG_FILTER || namespaces.some((ns) => info.module?.includes(ns))) {
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

export class Logger {
    public startTime = Date.now();
    public get output() {
        return Array.isArray(this.data) ? this.data.join('\n') : undefined;
    }
    public get elapsedTime() {
        return Date.now() - this.startTime;
    }
    constructor(
        private _logger,
        public data,
        private labels: { [key: string]: any },
    ) {}

    public log(...args) {
        this._logger.log('info', formatLogMessage(...args), this.labels);
    }
    public warn(...args) {
        this._logger.log('warn', formatLogMessage(...args), this.labels);
    }
    public debug(...args) {
        this._logger.log('debug', formatLogMessage(...args), this.labels);
    }
    public info(...args) {
        this._logger.log('info', formatLogMessage(...args), this.labels);
    }
    public verbose(...args) {
        this._logger.log('verbose', formatLogMessage(...args), this.labels);
    }

    public error(...args) {
        const stack = new Error().stack;

        this._logger.log('error', formatLogMessage(...args), { ...this.labels, stack });
    }
}

const colorizedFormat = winston.format.printf((info) => {
    return `${info.timestamp} ${winston.format.colorize().colorize(info.level, `${info.level}: ${info.message}`)}`;
});

const MAX_LOG_MESSAGE_LENGTH = 500;

function createBaseLogger(memoryStore?: any[]) {
    const logger = winston.createLogger({
        //level: 'info', // log level

        format: winston.format.combine(
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
                    winston.format.printf((info) => {
                        let message = info.message;
                        message = message?.length > MAX_LOG_MESSAGE_LENGTH ? message.substring(0, MAX_LOG_MESSAGE_LENGTH) + '...' : message;
                        return `${info.level}:${info.module || ''} ${message} ${info.stack || ''}`;
                    }),
                ),
                stderrLevels: ['error'], // Define levels that should be logged to stderr
            }),
            new winston.transports.Console({
                level: process.env.LOG_LEVEL || 'info',
                format: winston.format.combine(
                    namespaceFilter,
                    winston.format.printf((info) => {
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
                return JSON.stringify(arg, null, 2); // set the space to 2 for better readability
            }
            // Otherwise, just convert it to a string in case it's not
            return String(arg);
        })
        .join(' '); // Concatenate all arguments with a space
}

function createLabeledLogger(labels: { [key: string]: any }, memoryStore?: any[]) {
    const _logger = createBaseLogger(memoryStore);

    _logger.defaultMeta = labels;

    const logger = new Logger(_logger, memoryStore, labels);

    return logger;
}

export function createLogger(module: string, withMemoryStore = false) {
    return createLabeledLogger({ module }, withMemoryStore ? [] : undefined);
}
