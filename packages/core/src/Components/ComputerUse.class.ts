import { io, Socket } from 'socket.io-client';
import Joi from 'joi';
import { IAgent as Agent } from '@sre/types/Agent.types';
import { Component } from './Component.class';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import smythConfig from '@sre/config';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { ControlledPromise } from '../utils';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

interface AgentProgressPayload {
    status: 'iteration' | 'completion' | 'error';
    data: any;
    durationSec: number;
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

export class ComputerUse extends Component {
    protected configSchema = Joi.object({
        prompt: Joi.string().required().min(2).max(2000).label('Prompt'),
        environment: Joi.string().valid('browser').default('browser').label('Environment'),
    });

    private readonly API_URL = smythConfig.env.COMPUTER_USE_API_URL;
    private readonly PER_MINUTE_COST = 0.15;

    constructor() {
        super();
    }

    init() {}

    private setupSocket(): ControlledPromise<Socket> {
        return new ControlledPromise((resolve, reject, isSettled) => {
            try {
                const socket = io(this.API_URL);

                socket.once('connect', () => {
                    resolve(socket);
                });

                socket.once('connect_error', (error) => {
                    if (isSettled()) return;
                    console.error('ComputerUse: WebSocket connection failed:', error?.message);
                    // reject(new Error(`WebSocket connection failed: ${error.message}`));
                    reject(new Error('Something went wrong'));
                });

                socket.once('disconnect', (reason) => {
                    if (isSettled()) return;
                    console.error('ComputerUse: WebSocket disconnected:', reason);
                    reject(new Error('Something went wrong'));
                });

                setTimeout(() => {
                    if (isSettled()) return;
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
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);

        let teamId = agent?.teamId;

        // TODO: once we have multiple models supporting Comp Use, we can use the model from the config to dynamically load the appropriate model
        const model: string = '';
        const llmInference: LLMInference = await LLMInference.getInstance('gpt-4o-mini', AccessCandidate.agent(agent.id));

        let prompt = config.data?.prompt || input?.Prompt;
        prompt = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
        prompt = TemplateString(prompt).parse(input).result;
        prompt = llmInference.connector.enhancePrompt(prompt, config);

        let socket: Socket | null = null;
        // let agentActiveCheckInterval: NodeJS.Timeout | null = null;
        let totalExecTime: number | null = null;
        let fallbackTimer = {
            // fallback timer if computer use service fails to return execution time (due to early abort etc.)
            startTime: null,
            duration: null,
        };
        socket = await this.setupSocket();

        try {
            const runPromise: ControlledPromise<{ result: string; durationSec: number }> = new ControlledPromise((resolve, reject, isSettled) => {
                let result: any = null;
                // let executionTime: number | null = null;
                let error: any = null;
                let idleTimer: NodeJS.Timeout | null = null;
                const IDLE_TIMEOUT_MS = 70_000;
                fallbackTimer.startTime = process.hrtime();

                socket!.on('message', (message: WebSocketMessage) => {
                    updateIdleTimer();

                    switch (message.type) {
                        case 'agent:progress':
                            const progressPayload = message.payload as AgentProgressPayload;

                            switch (progressPayload.status) {
                                case 'completion':
                                    result = progressPayload.data;
                                    if (progressPayload.durationSec) {
                                        totalExecTime = progressPayload.durationSec;
                                    }
                                    // resolve({ result, durationSec: progressPayload.durationSec });

                                    break;
                                case 'error':
                                    error = progressPayload.data;
                                    break;
                                case 'iteration':
                                    if (agent.isKilled()) {
                                        // TODO: instead of killing the socket, we should send a message to the agent to stop
                                        socket?.disconnect();
                                        fallbackTimer.duration = this.calcDuration(fallbackTimer.startTime);
                                        console.log('Agent killed, disconnecting ComputerUse socket');
                                    }
                                    break;
                            }
                            break;

                        case 'agent:log':
                            const logPayload = message.payload as AgentLogPayload;
                            logger.debug(`\n${logPayload.message}`);
                            break;
                        case 'agent:ui_state_change':
                            const uiStatePayload = message.payload as { image_url?: string };
                            if (uiStatePayload.image_url) {
                                agent.sse.send('computer-use/ui-state', {
                                    componentId: config.id,
                                    image_url: uiStatePayload.image_url,
                                });
                            }
                            break;
                        case 'agent:usage':
                            const usagePayload = message.payload as any;
                            if (usagePayload.durationSec) {
                                totalExecTime = usagePayload.durationSec;
                            }
                            break;
                    }

                    if (totalExecTime && result) {
                        updateIdleTimer(false);
                        console.log('Completed run with result and execution time', result, totalExecTime);
                        resolve({ result, durationSec: totalExecTime });
                    } else if (totalExecTime && error) {
                        updateIdleTimer(false);
                        console.log('Completed run with error', error);
                        reject(new Error(error));
                    }
                });

                socket!.emit('message', {
                    type: 'agent:run',
                    payload: {
                        computer: 'local-playwright',
                        input: prompt,
                        logSteps: true,
                        startUrl: 'https://duckduckgo.com',
                    },
                });

                //
                socket!.once('disconnect', () => {
                    if (isSettled()) return;
                    console.error('ComputerUse: WebSocket disconnected midst computer use execution');
                    updateIdleTimer(false); // remove idle timer since we are already disconnecting
                    reject(new Error('Something went wrong'));
                });

                function updateIdleTimer(refresh: boolean = true) {
                    if (idleTimer) clearTimeout(idleTimer);
                    if (refresh) {
                        idleTimer = setTimeout(() => {
                            console.log('Computeruse socket: Idle too long as no messages received, disconnecting...');
                            socket!.disconnect();
                        }, IDLE_TIMEOUT_MS);
                    } else {
                        idleTimer = null;
                    }
                }
            });

            let agentResponse = await runPromise;

            // if (!agentResponse.durationSec) {
            //     const duration = process.hrtime(fallbackDurationStart);
            //     agentResponse.durationSec = duration[0] + duration[1] / 1e9;
            // }

            const result = llmInference.connector.postProcess(agentResponse.result);

            logger.debug('Run completed successfully.');
            logger.debug(`\n Total execution time: ${agentResponse.durationSec} seconds`);

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
        } finally {
            if (!totalExecTime && fallbackTimer.duration) {
                // fallback to our own fallback execution time calculation
                // const fallbackDuration = process.hrtime(fallbackTimer.startTime)[0] + process.hrtime(fallbackTimer.startTime)[1] / 1e9;
                console.log(`ComputerUse: No execution time from computer use service, using fallback ${fallbackTimer.duration.toFixed(2)} seconds`);
                totalExecTime = fallbackTimer.duration;
            }

            // report usage
            if (totalExecTime) {
                const cost = this.calculateExecutionCost(totalExecTime);
                console.log('ComputerUse: Reporting usage', cost);
                this.reportUsage({
                    cost,
                    agentId: agent.id,
                    teamId: agent.teamId,
                });
            } else {
                console.error('ComputerUse: No execution time from computer use service, skipping usage report !!!!!!!!!!!');
            }
        }
    }

    private calculateExecutionCost(durationSec: number) {
        return (durationSec / 60) * this.PER_MINUTE_COST;
    }

    protected reportUsage({ cost, agentId, teamId }: { cost: number; agentId: string; teamId: string }) {
        SystemEvents.emit('USAGE:API', {
            sourceId: 'api:computer_use.smyth',
            cost,
            agentId,
            teamId,
        });
    }

    private calcDuration(startTime: any) {
        const duration = process.hrtime(startTime)[0] + process.hrtime(startTime)[1] / 1e9;
        return duration;
    }
}
