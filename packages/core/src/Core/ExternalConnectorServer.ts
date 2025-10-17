import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { SystemEvents } from './SystemEvents';
import { Logger as createLogger } from '../helpers/Log.helper';

const Logger = createLogger('ExternalEventsReceiver');

export interface ExternalEventsReceiverConfig {
    port: number;
    authTokens: string[]; // List of valid authentication tokens
    enableHttp?: boolean; // Enable HTTP endpoint (default: true)
    enableWebSocket?: boolean; // Enable WebSocket endpoint (default: true)
    path?: string; // WebSocket path (default: '/ws')
}

export class ExternalEventsReceiver {
    private server: ReturnType<typeof createServer> | null = null;
    private wss: WebSocketServer | null = null;
    private config: Required<ExternalEventsReceiverConfig>;
    private isRunning = false;

    constructor(config: ExternalEventsReceiverConfig) {
        this.config = {
            enableHttp: true,
            enableWebSocket: true,
            path: '/ws',
            ...config,
        };

        if (!this.config.authTokens || this.config.authTokens.length === 0) {
            Logger.warn('At least one authentication token must be provided');
            throw new Error('At least one authentication token must be provided');
        }
    }

    /**
     * Start the HTTP and WebSocket server
     */
    public async start(): Promise<void> {
        if (this.isRunning) {
            Logger.warn('Server is already running');
            return;
        }

        // Create HTTP server
        this.server = createServer((req, res) => this.handleHttpRequest(req, res));

        // Create WebSocket server if enabled
        if (this.config.enableWebSocket) {
            this.wss = new WebSocketServer({
                server: this.server,
                path: this.config.path,
            });

            this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
                this.handleWebSocketConnection(ws, req);
            });
        }

        return new Promise((resolve, reject) => {
            this.server!.listen(this.config.port, () => {
                this.isRunning = true;
                Logger.info(
                    `Server started on port ${this.config.port}` +
                        (this.config.enableHttp ? ' [HTTP]' : '') +
                        (this.config.enableWebSocket ? ` [WebSocket: ${this.config.path}]` : '')
                );
                resolve();
            });

            this.server!.on('error', (error) => {
                Logger.error('Server error', error);
                reject(error);
            });
        });
    }

    /**
     * Stop the server
     */
    public async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        return new Promise((resolve, reject) => {
            // Close WebSocket server first
            if (this.wss) {
                this.wss.close((err) => {
                    if (err) {
                        Logger.error('Error closing WebSocket server', err);
                    }
                });
            }

            // Close HTTP server
            if (this.server) {
                this.server.close((err) => {
                    if (err) {
                        Logger.error('Error closing HTTP server', err);
                        reject(err);
                    } else {
                        this.isRunning = false;
                        Logger.info('Server stopped');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Handle HTTP requests
     */
    private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
        if (!this.config.enableHttp) {
            this.sendResponse(res, 404, { error: 'HTTP endpoint is disabled' });
            return;
        }

        // Only accept POST requests
        if (req.method !== 'POST') {
            this.sendResponse(res, 405, { error: 'Method not allowed. Only POST requests are accepted.' });
            return;
        }

        // Validate authentication
        const authResult = this.validateAuth(req.headers);
        if (!authResult.valid) {
            this.sendResponse(res, 401, { error: authResult.error });
            return;
        }

        // Get connector name from header
        const connectorName = this.getConnectorName(req.headers);
        if (!connectorName) {
            this.sendResponse(res, 400, { error: 'Missing x-connector-name header' });
            return;
        }

        // Read request body
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = body ? JSON.parse(body) : {};

                // Emit event
                this.emitExternalEvent(connectorName, data);

                this.sendResponse(res, 200, {
                    success: true,
                    message: `Event EXT:${connectorName} emitted successfully`,
                });
            } catch (error) {
                Logger.error('Error processing HTTP request', error);
                this.sendResponse(res, 400, {
                    error: 'Invalid JSON payload',
                });
            }
        });

        req.on('error', (error) => {
            Logger.error('HTTP request error', error);
            this.sendResponse(res, 500, { error: 'Internal server error' });
        });
    }

    /**
     * Handle WebSocket connections
     */
    private handleWebSocketConnection(ws: WebSocket, req: IncomingMessage): void {
        Logger.info('New WebSocket connection');

        // Validate authentication from headers
        const authResult = this.validateAuth(req.headers);
        if (!authResult.valid) {
            ws.close(1008, authResult.error);
            return;
        }

        // Get connector name from headers
        let connectorName = this.getConnectorName(req.headers);

        ws.on('message', (message: Buffer) => {
            try {
                const data = JSON.parse(message.toString());

                // If connector name not in headers, check message
                if (!connectorName) {
                    connectorName = data.connectorName || data['x-connector-name'];

                    if (!connectorName) {
                        ws.send(
                            JSON.stringify({
                                error: 'Missing connector name in headers or message',
                            })
                        );
                        return;
                    }
                }

                // Emit event
                this.emitExternalEvent(connectorName, data);

                // Send acknowledgment
                ws.send(
                    JSON.stringify({
                        success: true,
                        message: `Event EXT:${connectorName} emitted successfully`,
                    })
                );
            } catch (error) {
                Logger.error('Error processing WebSocket message', error);
                ws.send(
                    JSON.stringify({
                        error: 'Invalid JSON message',
                    })
                );
            }
        });

        ws.on('error', (error) => {
            Logger.error('WebSocket error', error);
        });

        ws.on('close', () => {
            Logger.info('WebSocket connection closed');
        });
    }

    /**
     * Validate authentication token
     */
    private validateAuth(headers: IncomingMessage['headers']): { valid: boolean; error?: string } {
        const authHeader = headers['authorization'] || headers['Authorization'];

        if (!authHeader) {
            return { valid: false, error: 'Missing Authorization header' };
        }

        // Support both "Bearer <token>" and "<token>" formats
        const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : authHeader[0]?.replace(/^Bearer\s+/i, '');

        if (!token) {
            return { valid: false, error: 'Invalid Authorization header format' };
        }

        if (!this.config.authTokens.includes(token)) {
            return { valid: false, error: 'Invalid authentication token' };
        }

        return { valid: true };
    }

    /**
     * Extract connector name from headers
     */
    private getConnectorName(headers: IncomingMessage['headers']): string | null {
        const connectorName = headers['x-connector-name'] || headers['X-Connector-Name'];
        return typeof connectorName === 'string' ? connectorName : connectorName?.[0] || null;
    }

    /**
     * Emit external connector event
     */
    private emitExternalEvent(connectorName: string, data: any): void {
        const eventName = `EXT:${connectorName}` as const;
        Logger.info(`Emitting event ${eventName}`);
        SystemEvents.emit(eventName, data);
    }

    /**
     * Send HTTP response
     */
    private sendResponse(res: ServerResponse, statusCode: number, body: any): void {
        res.statusCode = statusCode;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(body));
    }

    /**
     * Get server status
     */
    public getStatus(): { running: boolean; port: number; config: Required<ExternalEventsReceiverConfig> } {
        return {
            running: this.isRunning,
            port: this.config.port,
            config: this.config,
        };
    }
}
