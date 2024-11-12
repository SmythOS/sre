import { ErrorRequestHandler } from 'express';
import config from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('Error Middleware');

const errorHandler: ErrorRequestHandler = (err: any, _req, res, _next: any) => {
    // eslint-disable-next-line prefer-const
    let { statusCode, message, errKey } = err;

    if (!err.isOperational) {
        statusCode = 500;
        message = 'Internal Server Error';
    }

    res.locals.errorMessage = err.message;

    const response = {
        code: statusCode ?? 500,
        message: message ?? 'Internal Server Error',
        ...(config.env.NODE_ENV === 'development' && { stack: err.stack }),
        ...(errKey && { errKey }),
    };

    logger.error(new Error(`[${err.statusCode}] ${err.message} ${err.stack}`));

    // trafficCustomMetrics.errorCounter.labels({ method: _req.method, path: _req.path, status: statusCode ?? httpStatus.INTERNAL_SERVER_ERROR }).inc();

    res.status(statusCode ?? 500).send(response);
};

export { errorHandler };
