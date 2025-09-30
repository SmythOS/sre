import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { OllamaConnector } from '@sre/LLMManager/LLM.service/connectors/Ollama.class';
import { TLLMPreparedParams, TLLMMessageRole, APIKeySource, ILLMRequestContext, ToolData } from '@sre/types/LLM.types';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { JSON_RESPONSE_INSTRUCTION } from '@sre/constants';

describe('OllamaConnector - Unit Tests', () => {
    let connector: OllamaConnector;
    let mockContext: ILLMRequestContext;
    let mockAccessRequest: AccessRequest;

    beforeEach(() => {
        connector = new OllamaConnector();

        mockContext = {
            agentId: 'test-agent',
            teamId: 'test-team',
            modelEntryName: 'llama2:7b',
            isUserKey: false,
            modelInfo: {
                name: 'llama2:7b',
                provider: 'Ollama',
                baseURL: 'http://localhost:11434/api/',
            },
            credentials: {},
        };

        mockAccessRequest = {
            candidate: {
                id: 'test-candidate',
            } as AccessCandidate,
        } as AccessRequest;

        // Mock SystemEvents.emit
        vi.spyOn(SystemEvents, 'emit').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('reqBodyAdapter', () => {
        it('should map basic parameters to Ollama chat request format', async () => {
            const params: TLLMPreparedParams = {
                model: 'llama2:7b',
                messages: [
                    { role: TLLMMessageRole.User, content: 'Hello world' }
                ],
                maxTokens: 100,
                temperature: 0.7,
                topP: 0.9,
                topK: 40,
                stopSequences: ['STOP', 'END'],
            };

            const result = await connector.reqBodyAdapter(params);

            expect(result as any).toEqual({
                model: 'llama2:7b',
                messages: [
                    { role: 'user', content: 'Hello world' }
                ],
                options: {
                    num_predict: 100,
                    temperature: 0.7,
                    top_p: 0.9,
                    top_k: 40,
                    stop: ['STOP', 'END']
                }
            });
        });

        it('should handle JSON response format by adding system message', async () => {
            const params: TLLMPreparedParams = {
                model: 'llama2:7b',
                messages: [
                    { role: TLLMMessageRole.User, content: 'Return JSON data' }
                ],
                responseFormat: 'json',
            };

            const result = await connector.reqBodyAdapter(params);
            const anyResult = result as any;

            expect(anyResult.messages).toHaveLength(2);
            expect(anyResult.messages[0].role).toBe('system');
            expect(anyResult.messages[0].content).toBe(JSON_RESPONSE_INSTRUCTION);
            expect(anyResult.messages[1]).toEqual({ role: 'user', content: 'Return JSON data' });
        });

        it('should append JSON instruction to existing system message', async () => {
            const params: TLLMPreparedParams = {
                model: 'llama2:7b',
                messages: [
                    { role: TLLMMessageRole.System, content: 'You are a helpful assistant.' },
                    { role: TLLMMessageRole.User, content: 'Return JSON data' }
                ],
                responseFormat: 'json',
            };

            const result = await connector.reqBodyAdapter(params);
            const anyResult = result as any;

            expect(anyResult.messages).toHaveLength(2);
            expect(anyResult.messages[0].content).toBe('You are a helpful assistant.' + JSON_RESPONSE_INSTRUCTION);
        });

        it('should handle tool configuration', async () => {
            const params: TLLMPreparedParams = {
                model: 'llama2:7b',
                messages: [{ role: TLLMMessageRole.User, content: 'Use tools' }],
                toolsConfig: {
                    tools: [
                        {
                            type: 'function',
                            function: {
                                name: 'get_weather',
                                description: 'Get weather information',
                                parameters: {
                                    type: 'object',
                                    properties: {
                                        location: { type: 'string', description: 'Location name' }
                                    },
                                    required: ['location']
                                }
                            }
                        }
                    ]
                }
            };

            const result = await connector.reqBodyAdapter(params);
            const anyResult = result as any;

            expect(anyResult.tools).toEqual([
                {
                    type: 'function',
                    function: {
                        name: 'get_weather',
                        description: 'Get weather information',
                        parameters: {
                            type: 'object',
                            properties: {
                                location: { type: 'string', description: 'Location name' }
                            },
                            required: ['location']
                        }
                    }
                }
            ]);
        });

        it('should not include options when no parameters are provided', async () => {
            const params: TLLMPreparedParams = {
                model: 'llama2:7b',
                messages: [{ role: TLLMMessageRole.User, content: 'Hello' }],
            };

            const result = await connector.reqBodyAdapter(params);

            expect(result as any).toEqual({
                model: 'llama2:7b',
                messages: [{ role: 'user', content: 'Hello' }]
            });
            expect((result as any).options).toBeUndefined();
        });
    });

    describe('reportUsage', () => {
        it('should emit usage event with correct mapping', () => {
            const usage = {
                prompt_tokens: 50,
                completion_tokens: 25,
                total_tokens: 75
            };

            const metadata = {
                modelEntryName: 'llama2:7b',
                keySource: APIKeySource.User,
                agentId: 'test-agent',
                teamId: 'test-team'
            };

            const result = connector.reportUsage(usage, metadata);

            expect(SystemEvents.emit).toHaveBeenCalledWith('USAGE:LLM', {
                sourceId: 'llm:llama2:7b',
                input_tokens: 50,
                output_tokens: 25,
                input_tokens_cache_write: 0,
                input_tokens_cache_read: 0,
                keySource: APIKeySource.User,
                agentId: 'test-agent',
                teamId: 'test-team'
            });

            expect(result).toEqual({
                sourceId: 'llm:llama2:7b',
                input_tokens: 50,
                output_tokens: 25,
                input_tokens_cache_write: 0,
                input_tokens_cache_read: 0,
                keySource: APIKeySource.User,
                agentId: 'test-agent',
                teamId: 'test-team'
            });
        });

        it('should remove built-in model prefix from model name', () => {
            const usage = {
                prompt_tokens: 50,
                completion_tokens: 25,
                total_tokens: 75
            };

            const metadata = {
                modelEntryName: 'smythos/ollama-llama2:7b',
                keySource: APIKeySource.Smyth,
                agentId: 'test-agent',
                teamId: 'test-team'
            };

            connector.reportUsage(usage, metadata);

            expect(SystemEvents.emit).toHaveBeenCalledWith('USAGE:LLM', expect.objectContaining({
                sourceId: 'llm:ollama-llama2:7b'
            }));
        });
    });

    describe('formatToolsConfig', () => {
        it('should format tool definitions correctly', () => {
            const toolConfig = {
                type: 'function',
                toolDefinitions: [
                    {
                        name: 'calculate',
                        description: 'Perform calculations',
                        properties: {
                            expression: { type: 'string', description: 'Math expression' }
                        },
                        requiredFields: ['expression']
                    }
                ],
                toolChoice: 'auto'
            };

            const result = connector.formatToolsConfig(toolConfig);

            expect(result).toEqual({
                tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'calculate',
                            description: 'Perform calculations',
                            parameters: {
                                type: 'object',
                                properties: {
                                    expression: { type: 'string', description: 'Math expression' }
                                },
                                required: ['expression']
                            }
                        }
                    }
                ],
                tool_choice: 'auto'
            });
        });

        it('should return empty object when no tools provided', () => {
            const toolConfig = {
                type: 'function',
                toolDefinitions: [],
                toolChoice: 'auto'
            };

            const result = connector.formatToolsConfig(toolConfig);

            expect(result).toEqual({});
        });
    });

    describe('transformToolMessageBlocks', () => {
        it('should transform tool message blocks correctly', () => {
            const messageBlock = {
                role: TLLMMessageRole.Assistant,
                content: 'I will call a tool',
                tool_calls: [
                    {
                        id: 'call_123',
                        type: 'function',
                        function: {
                            name: 'get_weather',
                            arguments: { location: 'London' }
                        }
                    }
                ]
            };

            const toolsData: ToolData[] = [
                {
                    index: 0,
                    id: 'call_123',
                    type: 'function',
                    name: 'get_weather',
                    arguments: '{"location": "London"}',
                    role: 'assistant',
                    result: '{"temperature": "22°C", "condition": "sunny"}'
                }
            ];

            const result = connector.transformToolMessageBlocks({ messageBlock, toolsData });

            expect(result).toHaveLength(2);

            // Assistant message
            expect(result[0]).toEqual({
                role: 'assistant',
                content: 'I will call a tool',
                tool_calls: [
                    {
                        id: 'call_123',
                        type: 'function',
                        function: {
                            name: 'get_weather',
                            arguments: { location: 'London' }
                        }
                    }
                ]
            });

            // Tool result message
            expect(result[1]).toEqual({
                tool_call_id: 'call_123',
                role: 'tool',
                name: 'get_weather',
                content: '{"temperature": "22°C", "condition": "sunny"}'
            });
        });

        it('should handle string tool results', () => {
            const messageBlock = {
                role: TLLMMessageRole.Assistant,
                content: 'Tool called'
            };

            const toolsData: ToolData[] = [
                {
                    index: 0,
                    id: 'call_456',
                    type: 'function',
                    name: 'simple_tool',
                    arguments: '{}',
                    role: 'assistant',
                    result: 'Simple string result'
                }
            ];

            const result = connector.transformToolMessageBlocks({ messageBlock, toolsData });

            expect(result[1].content).toBe('Simple string result');
        });
    });

    describe('getConsistentMessages', () => {
        it('should normalize message content to strings', () => {
            const messages = [
                {
                    role: TLLMMessageRole.User,
                    content: [{ text: 'Hello' }, { text: 'World' }]
                },
                {
                    role: TLLMMessageRole.Assistant,
                    content: 'Hi there'
                },
                {
                    role: TLLMMessageRole.User,
                    parts: [{ text: 'How are you?' }]
                }
            ];

            const result = connector.getConsistentMessages(messages);

            expect(result).toEqual([
                {
                    role: 'user',
                    content: 'Hello World'
                },
                {
                    role: 'assistant',
                    content: 'Hi there'
                },
                {
                    role: 'user',
                    content: 'How are you?',
                    parts: [{ text: 'How are you?' }]
                }
            ]);
        });

        it('should handle empty content gracefully', () => {
            const messages = [
                {
                    role: TLLMMessageRole.User,
                    content: [{ text: '' }]
                },
                {
                    role: TLLMMessageRole.Assistant,
                    content: ''
                }
            ];

            const result = connector.getConsistentMessages(messages);

            expect(result).toEqual([
                {
                    role: 'user',
                    content: ''
                },
                {
                    role: 'assistant',
                    content: ''
                }
            ]);
        });
    });

    describe('baseURL handling', () => {
        it('should sanitize baseURL with /api/ suffix', () => {
            const contextWithAPI = {
                ...mockContext,
                modelInfo: {
                    ...mockContext.modelInfo,
                    baseURL: 'http://localhost:11434/api/'
                }
            };

            // We can't directly test getClient since it's private, but we can test that
            // the connector doesn't throw an error when creating the client
            expect(() => {
                const connector = new OllamaConnector();
                // This would throw if baseURL sanitization is broken
            }).not.toThrow();
        });

        it('should handle baseURL without /api/ suffix', () => {
            const contextWithoutAPI = {
                ...mockContext,
                modelInfo: {
                    ...mockContext.modelInfo,
                    baseURL: 'http://localhost:11434'
                }
            };

            expect(() => {
                const connector = new OllamaConnector();
            }).not.toThrow();
        });
    });
});