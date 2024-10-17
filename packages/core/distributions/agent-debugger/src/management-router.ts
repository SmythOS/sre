import express from 'express';
import { app } from './app';
import { Server } from 'http';
import config from './config';

const ADMIN_PORT = parseInt(process.env.ADMIN_PORT || '8080');
const PORT = parseInt(process.env.PORT || '3000');
// eslint-disable-next-line import/no-mutable-exports
export let server: Server;

import { createLogger } from './services/logger';

const logger = createLogger('___FILENAME___');
const host = config.env.NODE_ENV === 'PROD' ? 'localhost' : '';

function enableAppPort() {
    if (server && server.listening) {
        logger.info(`Server is already running at http://localhost:${PORT}`);
        return server;
    }

    server = app.listen(PORT, host, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
    });

    return server;
}

// Function to disable port 5000 to stop accepting new connections
function disableAppPort() {
    server.close(() => {
        logger.info(`App Server listening on port ${PORT} no longer accepting connections`);
    });
}

// Management app listening on port 8080
export const managementApp = express();

// Route to handle management operations
managementApp.get('/', (req, res) => {
    res.send('Management operations.');
});

// Route to enable port 5000 for new connections
managementApp.get('/enable', (req, res) => {
    enableAppPort();
    res.send(`Port ${PORT} enabled for new connections via management port.`);
});

// Route to disable port 5000 for new connections
managementApp.get('/disable', (req, res) => {
    disableAppPort();
    res.send(`Port ${PORT} disabled for new connections via management port.`);
});

// managementApp.get('/metrics', async (req, res) => {
//   LOGGER.info('FLUSHING METRICS TO PROMETHEUS');
//   res.set('Content-Type', metricsManager.metricesRegister.contentType);
//   res.end(await metricsManager.metricesRegister.metrics());
// });

export function startServers() {
    managementApp.listen(ADMIN_PORT, host, () => {
        logger.info(`Management server listening on port ${ADMIN_PORT}`);
    });

    const appServer = enableAppPort();
    return appServer;
}
