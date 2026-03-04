import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ResponsesApiInterface } from '@sre/LLMManager/LLM.service/connectors/openai/apiInterfaces/ResponsesApiInterface';
import { TLLMParams, TLLMPreparedParams, ILLMRequestContext, TLLMMessageRole } from '@sre/types/LLM.types';
import { checkIntegrationTestConsent } from '../../../utils/test-data-manager';

checkIntegrationTestConsent();

describe('ResponsesApiInterface - Unit Tests', () => {
    let apiInterface: ResponsesApiInterface;
    let mockContext: ILLMRequestContext;
    let mockDeps: any;

    beforeEach(() => {
        mockDeps = {
            getClient: vi.fn(),
            reportUsage: vi.fn(),
        };

        mockContext = {
            agentId: 'test-agent',
            teamId: 'test-team',
            modelEntryName: 'gpt-4o',
            isUserKey: false,
            toolsInfo: undefined,
            modelInfo: { name: 'gpt-4o', provider: 'openai' },
            credentials: { apiKey: 'test-key', isUserKey: true },
        };

        apiInterface = new ResponsesApiInterface(mockContext, mockDeps);
    });

    describe('transformToolsConfig', () => {
        it('should transform tool definitions to Responses API format', () => {
            const toolConfig = {
                type: 'function' as const,
                toolDefinitions: [
                    {
                        name: 'get_weather',
                        description: 'Get weather information',
                        properties: {
                            location: { type: 'string', description: 'Location name' },
                        },
                        requiredFields: ['location'],
                    },
                ],
                toolChoice: 'auto' as const,
            };

            const result = apiInterface.transformToolsConfig(toolConfig);

            expect(result).toEqual([
                {
                    type: 'function',
                    name: 'get_weather',
                    description: 'Get weather information',
                    parameters: {
                        type: 'object',
                        properties: {
                            location: { type: 'string', description: 'Location name' },
                        },
                        required: ['location'],
                    },
                    strict: false,
                },
            ]);
        });

        it('should handle empty tool definitions', () => {
            const toolConfig = {
                type: 'function' as const,
                toolDefinitions: [],
                toolChoice: 'auto' as const,
            };

            const result = apiInterface.transformToolsConfig(toolConfig);

            expect(result).toEqual([]);
        });
    });

    describe('validateParameters', () => {
        it('should return true for valid parameters with model', () => {
            const validParams: TLLMParams = {
                model: 'gpt-4o',
                agentId: 'test-agent',
            };

            const result = apiInterface.validateParameters(validParams);

            expect(result).toBe(true);
        });

        it('should return false when model is missing', () => {
            const invalidParams = {
                agentId: 'test-agent',
            } as TLLMParams;

            const result = apiInterface.validateParameters(invalidParams);

            expect(result).toBe(false);
        });

        it('should return true even without messages (unlike ChatCompletions)', () => {
            const validParams: TLLMParams = {
                model: 'gpt-4o',
                agentId: 'test-agent',
                // No messages required for Responses API validation
            };

            const result = apiInterface.validateParameters(validParams);

            expect(result).toBe(true);
        });
    });

    describe('getInterfaceName', () => {
        it('should return correct interface name', () => {
            const result = apiInterface.getInterfaceName();
            expect(result).toBe('responses');
        });
    });

    describe('prepareRequestBody', () => {
        it('should map basic parameters correctly', async () => {
            const params: TLLMPreparedParams = {
                model: 'gpt-4o',
                messages: [{ role: TLLMMessageRole.User, content: 'Hello' }],
                maxTokens: 100,
                temperature: 0.7,
                topP: 0.9,
                agentId: 'test-agent',
                body: {},
                toolsInfo: {
                    openai: {
                        webSearch: {
                            enabled: false,
                            contextSize: 'medium',
                        },
                    },
                    xai: {
                        search: {
                            enabled: false,
                        },
                    },
                },
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result).toEqual({
                model: 'gpt-4o',
                input: [{ role: 'user', content: 'Hello' }],
                max_output_tokens: 100,
                temperature: 0.7,
                top_p: 0.9,
            });
        });

        it('should not map unsupported parameters like frequency_penalty', async () => {
            const params: TLLMPreparedParams = {
                model: 'gpt-4o',
                messages: [{ role: TLLMMessageRole.User, content: 'Hello' }],
                frequencyPenalty: 0.5,
                presencePenalty: 0.3,
                agentId: 'test-agent',
                body: {},
                toolsInfo: {
                    openai: {
                        webSearch: {
                            enabled: false,
                            contextSize: 'medium',
                        },
                    },
                    xai: {
                        search: {
                            enabled: false,
                        },
                    },
                },
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result).not.toHaveProperty('frequency_penalty');
            expect(result).not.toHaveProperty('presence_penalty');
        });

        it('should include web search tool when enabled', async () => {
            const params: TLLMPreparedParams = {
                model: 'gpt-4o',
                messages: [{ role: TLLMMessageRole.User, content: 'Hello' }],
                agentId: 'test-agent',
                body: {},
                toolsInfo: {
                    openai: {
                        webSearch: {
                            enabled: true,
                            contextSize: 'medium',
                            city: 'New York',
                            country: 'USA',
                        },
                    },
                    xai: {
                        search: {
                            enabled: false,
                        },
                    },
                },
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result.tools).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'web_search_preview',
                    }),
                ])
            );
        });
    });

    describe('Message Transformation (applyToolMessageTransformation)', () => {
        it('should transform assistant messages with tool_calls into separate items', async () => {
            const params: TLLMPreparedParams = {
                model: 'gpt-4o',
                messages: [
                    { role: TLLMMessageRole.User, content: 'Get weather' },
                    {
                        role: TLLMMessageRole.Assistant,
                        content: 'I will get the weather for you.',
                        tool_calls: [
                            {
                                id: 'call_123',
                                type: 'function',
                                function: {
                                    name: 'get_weather',
                                    arguments: '{"location": "New York"}',
                                },
                            },
                        ],
                    },
                ],
                agentId: 'test-agent',
                body: {},
                toolsInfo: {
                    openai: {
                        webSearch: {
                            enabled: false,
                            contextSize: 'medium',
                        },
                    },
                    xai: {
                        search: {
                            enabled: false,
                        },
                    },
                },
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result.input).toEqual([
                { role: 'user', content: 'Get weather' },
                { role: 'assistant', content: 'I will get the weather for you.' },
                {
                    type: 'function_call',
                    name: 'get_weather',
                    arguments: '{"location": "New York"}',
                    call_id: 'call_123',
                },
            ]);
        });

        it('should transform tool messages to function_call_output', async () => {
            const params: TLLMPreparedParams = {
                model: 'gpt-4o',
                messages: [
                    { role: TLLMMessageRole.User, content: 'Get weather' },
                    {
                        role: TLLMMessageRole.Tool,
                        tool_call_id: 'call_123',
                        content: 'Weather is sunny, 72°F',
                    },
                ],
                agentId: 'test-agent',
                body: {},
                toolsInfo: {
                    openai: {
                        webSearch: {
                            enabled: false,
                            contextSize: 'medium',
                        },
                    },
                    xai: {
                        search: {
                            enabled: false,
                        },
                    },
                },
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result.input).toEqual([
                { role: 'user', content: 'Get weather' },
                {
                    type: 'function_call_output',
                    call_id: 'call_123',
                    output: 'Weather is sunny, 72°F',
                },
            ]);
        });

        it('should handle tool messages with object content', async () => {
            const params: TLLMPreparedParams = {
                model: 'gpt-4o',
                messages: [
                    {
                        role: TLLMMessageRole.Tool,
                        tool_call_id: 'call_123',
                        content: { temperature: 72, condition: 'sunny' },
                    },
                ],
                agentId: 'test-agent',
                body: {},
                toolsInfo: {
                    openai: {
                        webSearch: {
                            enabled: false,
                            contextSize: 'medium',
                        },
                    },
                    xai: {
                        search: {
                            enabled: false,
                        },
                    },
                },
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result.input).toEqual([
                {
                    type: 'function_call_output',
                    call_id: 'call_123',
                    output: '{"temperature":72,"condition":"sunny"}',
                },
            ]);
        });

        it('should handle assistant message without content but with tool_calls', async () => {
            const params: TLLMPreparedParams = {
                model: 'gpt-4o',
                messages: [
                    {
                        role: TLLMMessageRole.Assistant,
                        tool_calls: [
                            {
                                id: 'call_123',
                                type: 'function',
                                function: {
                                    name: 'get_weather',
                                    arguments: { location: 'New York' },
                                },
                            },
                        ],
                    },
                ],
                agentId: 'test-agent',
                body: {},
                toolsInfo: {
                    openai: {
                        webSearch: {
                            enabled: false,
                            contextSize: 'medium',
                        },
                    },
                    xai: {
                        search: {
                            enabled: false,
                        },
                    },
                },
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result.input).toEqual([
                {
                    type: 'function_call',
                    name: 'get_weather',
                    arguments: '{"location":"New York"}',
                    call_id: 'call_123',
                },
            ]);
        });
    });

    describe('Web Search Tool Configuration', () => {
        it('should create web search tool with context size', async () => {
            const params: TLLMPreparedParams = {
                model: 'gpt-4o',
                messages: [{ role: TLLMMessageRole.User, content: 'Search for news' }],
                agentId: 'test-agent',
                body: {},
                toolsInfo: {
                    openai: {
                        webSearch: {
                            enabled: true,
                            contextSize: 'high',
                        },
                    },
                    xai: {
                        search: {
                            enabled: false,
                        },
                    },
                },
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result.tools).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'web_search_preview',
                    }),
                ])
            );
        });

        it('should create web search tool with location parameters', async () => {
            const params: TLLMPreparedParams = {
                model: 'gpt-4o',
                messages: [{ role: TLLMMessageRole.User, content: 'Search for local news' }],
                agentId: 'test-agent',
                body: {},
                toolsInfo: {
                    openai: {
                        webSearch: {
                            enabled: true,
                            contextSize: 'medium',
                            city: 'San Francisco',
                            country: 'USA',
                            region: 'California',
                            timezone: 'America/Los_Angeles',
                        },
                    },
                    xai: {
                        search: {
                            enabled: false,
                        },
                    },
                },
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result.tools).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'web_search_preview',
                    }),
                ])
            );
        });

        it('should not include web search tool when disabled', async () => {
            const params: TLLMPreparedParams = {
                model: 'gpt-4o',
                messages: [{ role: TLLMMessageRole.User, content: 'Hello' }],
                agentId: 'test-agent',
                body: {},
                toolsInfo: {
                    openai: {
                        webSearch: {
                            enabled: false,
                            contextSize: 'medium',
                        },
                    },
                    xai: {
                        search: {
                            enabled: false,
                        },
                    },
                },
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result.tools || []).not.toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'web_search_preview',
                    }),
                ])
            );
        });
    });

    describe('Content Normalization', () => {
        it('should handle string content', async () => {
            const params: TLLMPreparedParams = {
                model: 'gpt-4o',
                messages: [{ role: TLLMMessageRole.User, content: 'Simple string content' }],
                agentId: 'test-agent',
                body: {},
                toolsInfo: {
                    openai: {
                        webSearch: {
                            enabled: false,
                            contextSize: 'medium',
                        },
                    },
                    xai: {
                        search: {
                            enabled: false,
                        },
                    },
                },
            };

            const result = await apiInterface.prepareRequestBody(params);

            // The first input item should have content property
            const firstInput = result.input[0];
            expect(firstInput).toHaveProperty('content');
            expect((firstInput as any).content).toBe('Simple string content');
        });

        it('should handle array content as-is (not normalized at this level)', async () => {
            const params: TLLMPreparedParams = {
                model: 'gpt-4o',
                messages: [
                    {
                        role: TLLMMessageRole.User,
                        content: [
                            { type: 'text', text: 'Hello' },
                            { type: 'text', text: 'World' },
                        ],
                    },
                ],
                agentId: 'test-agent',
                body: {},
                toolsInfo: {
                    openai: {
                        webSearch: {
                            enabled: false,
                            contextSize: 'medium',
                        },
                    },
                    xai: {
                        search: {
                            enabled: false,
                        },
                    },
                },
            };

            const result = await apiInterface.prepareRequestBody(params);

            const firstInput = result.input[0];
            expect(firstInput).toHaveProperty('content');
            expect((firstInput as any).content).toEqual([
                { type: 'text', text: 'Hello' },
                { type: 'text', text: 'World' },
            ]);
        });

        it('should handle object content as-is (not normalized at this level)', async () => {
            const params: TLLMPreparedParams = {
                model: 'gpt-4o',
                messages: [
                    {
                        role: TLLMMessageRole.User,
                        content: { message: 'Hello', priority: 'high' },
                    },
                ],
                agentId: 'test-agent',
                body: {},
                toolsInfo: {
                    openai: {
                        webSearch: {
                            enabled: false,
                            contextSize: 'medium',
                        },
                    },
                    xai: {
                        search: {
                            enabled: false,
                        },
                    },
                },
            };

            const result = await apiInterface.prepareRequestBody(params);

            const firstInput = result.input[0];
            expect(firstInput).toHaveProperty('content');
            expect((firstInput as any).content).toEqual({ message: 'Hello', priority: 'high' });
        });
    });

    describe('Tool Arguments Normalization', () => {
        it('should handle string tool arguments', async () => {
            const params: TLLMPreparedParams = {
                model: 'gpt-4o',
                messages: [
                    {
                        role: TLLMMessageRole.Assistant,
                        tool_calls: [
                            {
                                id: 'call_123',
                                type: 'function',
                                function: {
                                    name: 'test_tool',
                                    arguments: '{"param": "value"}',
                                },
                            },
                        ],
                    },
                ],
                agentId: 'test-agent',
                body: {},
                toolsInfo: {
                    openai: {
                        webSearch: {
                            enabled: false,
                            contextSize: 'medium',
                        },
                    },
                    xai: {
                        search: {
                            enabled: false,
                        },
                    },
                },
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result.input).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        arguments: '{"param": "value"}',
                    }),
                ])
            );
        });

        it('should stringify object tool arguments', async () => {
            const params: TLLMPreparedParams = {
                model: 'gpt-4o',
                messages: [
                    {
                        role: TLLMMessageRole.Assistant,
                        tool_calls: [
                            {
                                id: 'call_123',
                                type: 'function',
                                function: {
                                    name: 'test_tool',
                                    arguments: { param: 'value', count: 42 },
                                },
                            },
                        ],
                    },
                ],
                agentId: 'test-agent',
                body: {},
                toolsInfo: {
                    openai: {
                        webSearch: {
                            enabled: false,
                            contextSize: 'medium',
                        },
                    },
                    xai: {
                        search: {
                            enabled: false,
                        },
                    },
                },
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result.input).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        arguments: '{"param":"value","count":42}',
                    }),
                ])
            );
        });

        it('should handle null/undefined tool arguments as-is', async () => {
            const params: TLLMPreparedParams = {
                model: 'gpt-4o',
                messages: [
                    {
                        role: TLLMMessageRole.Assistant,
                        tool_calls: [
                            {
                                id: 'call_123',
                                type: 'function',
                                function: {
                                    name: 'test_tool',
                                    arguments: undefined,
                                },
                            },
                        ],
                    },
                ],
                agentId: 'test-agent',
                body: {},
                toolsInfo: {
                    openai: {
                        webSearch: {
                            enabled: false,
                            contextSize: 'medium',
                        },
                    },
                    xai: {
                        search: {
                            enabled: false,
                        },
                    },
                },
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result.input).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        arguments: undefined,
                        call_id: 'call_123',
                        name: 'test_tool',
                        type: 'function_call',
                    }),
                ])
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed tool configuration gracefully', () => {
            const toolConfig = {
                type: 'function' as const,
                toolDefinitions: [
                    {
                        // Missing required fields
                    } as any,
                ],
                toolChoice: 'auto' as const,
            };

            const result = apiInterface.transformToolsConfig(toolConfig);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'function',
                name: undefined,
                description: undefined,
                parameters: {
                    type: 'object',
                    properties: undefined,
                    required: undefined,
                },
                strict: false,
            });
        });

        it('should not modify content structure at prepareRequestBody level', async () => {
            const complexContent = {
                type: 'complex',
                data: [1, 2, 3],
                nested: { key: 'value' },
            };

            const params: TLLMPreparedParams = {
                model: 'gpt-4o',
                messages: [
                    {
                        role: TLLMMessageRole.User,
                        content: complexContent,
                    },
                ],
                agentId: 'test-agent',
                body: {},
                toolsInfo: {
                    openai: {
                        webSearch: {
                            enabled: false,
                            contextSize: 'medium',
                        },
                    },
                    xai: {
                        search: {
                            enabled: false,
                        },
                    },
                },
            };

            const result = await apiInterface.prepareRequestBody(params);

            // Content should be passed through as-is at this level
            const firstInput = result.input[0];
            expect(firstInput).toHaveProperty('content');
            expect((firstInput as any).content).toEqual(complexContent);
        });
    });
});
