import express from 'express';

import { createLogger } from '../services/logger';
const console = createLogger('___FILENAME___');

// @ts-ignore
export function errorHandler(err: express.Error, req: express.Request, res: express.Response, next: express.NextFunction) {
    if (err) {
        if (err.type === 'entity.too.large') {
            return res.status(413).send({ error: 'Payload Too Large' });
        }

        const errorMessage = { error: err.message };

        res.status(500).send(errorMessage);
    }
}
