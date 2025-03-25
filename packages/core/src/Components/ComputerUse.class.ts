import { io, Socket } from 'socket.io-client';
import Joi from 'joi';
import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import smythConfig from '@sre/config';

interface AgentProgressPayload {
    status: 'iteration' | 'completion' | 'error';
    data: any;
    timestamp: number;
}

interface AgentLogPayload {
    message: string;
    timestamp: number;
}

interface WebSocketMessage {
    type: string;
    payload: AgentProgressPayload | AgentLogPayload;
}

export default class ComputerUse extends Component {
    protected configSchema = Joi.object({
        prompt: Joi.string().required().min(2).max(2000).label('Prompt'),
        environment: Joi.string().valid('browser').default('browser').label('Environment'),
    });

    private readonly API_URL = smythConfig.env.COMPUTER_USE_API_URL;

    constructor() {
        super();
    }

    init() {}

    private setupSocket(): Promise<Socket> {
        return new Promise((resolve, reject) => {
            try {
                const socket = io(this.API_URL);

                socket.on('connect', () => {
                    resolve(socket);
                });

                socket.on('connect_error', (error) => {
                    console.error('ComputerUse: WebSocket connection failed:', error);
                    // reject(new Error(`WebSocket connection failed: ${error.message}`));
                    reject(new Error('Something went wrong'));
                });

                socket.on('disconnect', (reason) => {
                    console.error('ComputerUse: WebSocket disconnected:', reason);
                    reject(new Error('Something went wrong'));
                });

                setTimeout(() => {
                    if (!socket.connected) {
                        socket.close();
                        console.error('ComputerUse: WebSocket connection timeout');
                        // reject(new Error('WebSocket connection timeout'));
                        reject(new Error('Something went wrong'));
                    }
                }, 5000);
            } catch (error) {
                reject(new Error(`Failed to create WebSocket connection: ${error.message}`));
            }
        });
    }

    async process(input, config, agent: Agent) {
        if (smythConfig.env.NODE_ENV !== 'DEV') {
            throw new Error('ComputerUse is not available');
        }
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);

        let prompt = config.data?.prompt || input?.Prompt;
        prompt = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
        prompt = TemplateString(prompt).parse(input).result;

        let socket: Socket | null = null;
        try {
            socket = await this.setupSocket();
            agent.kill;

            const agentRunPromise = new Promise((resolve, reject) => {
                let result: any = null;

                socket!.on('message', (message: WebSocketMessage) => {
                    switch (message.type) {
                        case 'agent:progress':
                            const progressPayload = message.payload as AgentProgressPayload;

                            switch (progressPayload.status) {
                                case 'completion':
                                    logger.debug(`computer session completed`);
                                    result = progressPayload.data;
                                    resolve(result);

                                    break;
                                case 'error':
                                    reject(new Error(progressPayload.data));
                                    break;
                                case 'iteration':
                                    // logger.debug(` Agent iteration`);
                                    break;
                            }
                            break;

                        case 'agent:log':
                            const logPayload = message.payload as AgentLogPayload;
                            // if (typeof agent.callback === 'function') {
                            //     agent.callback({ log: logPayload.message });
                            // }
                            // TODO: send this as "component" message with the appropriate config
                            // agent.sse.send('computer/logs', logPayload.message);
                            logger.debug(logPayload.message);
                            break;
                    }
                });

                socket!.emit('message', {
                    type: 'agent:run',
                    payload: {
                        computer: 'local-playwright',
                        input: prompt,
                        logSteps: true,
                        startUrl: 'https://bing.com',
                    },
                });
            });

            const result = await agentRunPromise;
            logger.debug(' Agent run completed successfully');

            if (socket?.connected) {
                socket.disconnect();
            }

            return {
                Output: result,
                _debug: logger.output,
            };
        } catch (error: any) {
            if (socket?.connected) {
                socket.disconnect();
            }

            logger.error(` Error: ${error.message}`);
            return {
                Output: undefined,
                _error: error.message,
                _debug: logger.output,
            };
        }
    }
}
