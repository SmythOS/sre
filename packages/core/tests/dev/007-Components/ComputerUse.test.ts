import { Agent, AgentSettings, CLIAgentDataConnector, ConnectorService, SmythRuntime } from '@sre/index';
import { TConnectorService } from '@sre/types/SRE.types';
import { describe, expect, it, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import ComputerUse from '@sre/Components/ComputerUse.class';
import { io } from 'socket.io-client';
import config from '@sre/config';
import { AgentSSE } from '@sre/AgentManager/AgentSSE.class';

// Initialize SmythRuntime
const sre = SmythRuntime.Instance.init({
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: config.env.AWS_S3_BUCKET_NAME || '',
            region: config.env.AWS_S3_REGION || '',
            accessKeyId: config.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: config.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
});

ConnectorService.register(TConnectorService.AgentData, 'CLI', CLIAgentDataConnector);
ConnectorService.init(TConnectorService.AgentData, 'CLI');

// Mock socket.io-client for unit tests
vi.mock('socket.io-client', () => {
    const mockSocket = {
        on: vi.fn(),
        emit: vi.fn(),
        connected: true,
        disconnect: vi.fn(),
    };
    return {
        io: vi.fn(() => mockSocket),
    };
});
// Mock AgentSSE implementation
class MockAgentSSE extends AgentSSE {
    constructor(agent: any) {
        super(agent);
    }

    async send(_type: string, _data: any): Promise<void> {
        return Promise.resolve();
    }

    add(connection: any, monitorId: string): boolean {
        return true;
    }

    remove(monitorId: string): boolean {
        return true;
    }

    async close(): Promise<void> {
        return Promise.resolve();
    }

    getConnectionCount(): number {
        return super.getConnectionCount();
    }
}

vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => {
        // Inherit Agent.prototype for proper instanceof Agent checks
        return Object.create(Agent.prototype, {
            id: { value: 1 }, // used inside inferBinaryType()
            agentRuntime: { value: { debug: true } }, // used inside createComponentLogger()
            teamId: { value: 'default' },
        });
    });
    return { default: MockedAgent };
});

describe('ComputerUse Component', () => {
    describe('Unit Tests', () => {
        let computerUse: ComputerUse;
        let mockSocket: any;
        let mockAgent: Agent;

        beforeEach(() => {
            computerUse = new ComputerUse();
            mockSocket = io();
            // @ts-ignore
            mockAgent = new Agent();
            // Set up mock SSE
            mockAgent.sse = new MockAgentSSE(mockAgent);
            // Override send for unit tests
            mockAgent.sse.send = async (_type: string, _data: any): Promise<void> => {
                return Promise.resolve();
            };
        });

        afterEach(() => {
            vi.clearAllMocks();
        });

        it('successfully processes a prompt and returns result', async () => {
            mockSocket.on.mockImplementation((event, callback) => {
                if (event === 'connect') {
                    callback();
                }
                if (event === 'message') {
                    callback({
                        type: 'agent:progress',
                        payload: {
                            status: 'completion',
                            data: { result: 'Task completed successfully' },
                            timestamp: Date.now(),
                        },
                    });
                }
            });

            const output = await computerUse.process(
                {},
                {
                    name: 'TestComputerUse',
                    data: {
                        prompt: 'Go to google.com and search for "test"',
                        environment: 'browser',
                        startUrl: 'https://google.com',
                        debug: true,
                    },
                },
                mockAgent,
            );

            expect(output.Output).toBeDefined();
            expect(output.Output.result).toBe('Task completed successfully');
            expect(output._error).toBeUndefined();
            expect(mockSocket.emit).toHaveBeenCalledWith('message', {
                type: 'agent:run',
                payload: expect.objectContaining({
                    computer: 'local-playwright',
                    input: 'Go to google.com and search for "test"',
                }),
            });
        });

        it('handles connection errors', async () => {
            mockSocket.on.mockImplementation((event, callback) => {
                if (event === 'connect_error') {
                    callback(new Error('Connection failed'));
                }
            });

            const output = await computerUse.process(
                {},
                {
                    name: 'TestComputerUse',
                    data: {
                        prompt: 'Go to google.com',
                        environment: 'browser',
                    },
                },
                mockAgent,
            );

            expect(output.Output).toBeUndefined();
            expect(output._error).toBeDefined();
            expect(output._error).toContain('Connection failed');
        });

        it('forwards agent logs correctly', async () => {
            const logs: string[] = [];
            // @ts-ignore
            const testAgent = new Agent();
            testAgent.sse = new MockAgentSSE(testAgent);
            testAgent.sse.send = async (_type: string, _data: any): Promise<void> => {
                if (_type === 'computer/logs') {
                    logs.push(_data);
                }
                return Promise.resolve();
            };

            mockSocket.on.mockImplementation((event, callback) => {
                if (event === 'connect') {
                    callback();
                }
                if (event === 'message') {
                    callback({
                        type: 'agent:log',
                        payload: {
                            message: 'Test log message',
                            timestamp: Date.now(),
                        },
                    });
                    callback({
                        type: 'agent:progress',
                        payload: {
                            status: 'completion',
                            data: { result: 'Done' },
                            timestamp: Date.now(),
                        },
                    });
                }
            });

            await computerUse.process(
                {},
                {
                    name: 'TestComputerUse',
                    data: {
                        prompt: 'Test prompt',
                        environment: 'browser',
                    },
                },
                testAgent,
            );

            expect(logs.length).toBeGreaterThan(0);
            expect(logs[0]).toBe('Test log message');
        });
    });

    describe('Integration Tests', () => {
        let computerUse: ComputerUse;
        let agent: Agent;
        const TEST_TIMEOUT = 30000; // 30 seconds timeout for integration tests

        beforeAll(() => {
            computerUse = new ComputerUse();
            // @ts-ignore
            agent = new Agent();
            // Set up mock SSE with logging
            agent.sse = new MockAgentSSE(agent);
            agent.sse.send = async (_type: string, _data: any): Promise<void> => {
                console.log(`SSE ${_type}:`, _data);
                return Promise.resolve();
            };
            agent.callback = (data: any) => {
                console.log('Agent callback:', data);
            };
        });

        it(
            'should successfully execute a simple browser task',
            async () => {
                const output = await computerUse.process(
                    {},
                    {
                        name: 'TestComputerUse',
                        data: {
                            prompt: 'Go to google.com and verify the page title contains "Google"',
                            environment: 'browser',
                            startUrl: 'https://google.com',
                            debug: true,
                        },
                    },
                    agent,
                );

                expect(output.Output).toBeDefined();
                expect(output._error).toBeUndefined();
                expect(output._debug).toBeDefined();
            },
            TEST_TIMEOUT,
        );

        it(
            'should handle network timeouts gracefully',
            async () => {
                const output = await computerUse.process(
                    {},
                    {
                        name: 'TestComputerUse',
                        data: {
                            prompt: 'Go to a non-existent domain that will timeout',
                            environment: 'browser',
                            startUrl: 'https://this-domain-does-not-exist-test.com',
                            debug: true,
                        },
                    },
                    agent,
                );

                expect(output.Output).toBeUndefined();
                expect(output._error).toBeDefined();
                expect(output._debug).toBeDefined();
            },
            TEST_TIMEOUT,
        );

        it(
            'should execute a complex multi-step browser task',
            async () => {
                const output = await computerUse.process(
                    {},
                    {
                        name: 'TestComputerUse',
                        data: {
                            prompt: `
                            1. Go to google.com
                            2. Search for "OpenAI news"
                            3. Click on the first search result
                            4. Verify you've navigated away from Google
                        `,
                            environment: 'browser',
                            startUrl: 'https://google.com',
                            debug: true,
                        },
                    },
                    agent,
                );

                expect(output.Output).toBeDefined();
                expect(output._error).toBeUndefined();
                expect(output._debug).toBeDefined();
            },
            TEST_TIMEOUT,
        );

        it(
            'should receive and process streaming logs',
            async () => {
                const logs: string[] = [];
                // @ts-ignore
                const testAgent = new Agent();
                testAgent.sse = new MockAgentSSE(testAgent);
                testAgent.sse.send = async (_type: string, _data: any): Promise<void> => {
                    if (_type === 'computer/logs') {
                        logs.push(_data);
                    }
                    return Promise.resolve();
                };

                const output = await computerUse.process(
                    {},
                    {
                        name: 'TestComputerUse',
                        data: {
                            prompt: 'Go to wikipedia.org and click on the English link',
                            environment: 'browser',
                            startUrl: 'https://wikipedia.org',
                            debug: true,
                        },
                    },
                    testAgent,
                );

                expect(logs.length).toBeGreaterThan(0);
                expect(output.Output).toBeDefined();
                expect(output._error).toBeUndefined();
                expect(output._debug).toBeDefined();
            },
            TEST_TIMEOUT,
        );
    });
});
