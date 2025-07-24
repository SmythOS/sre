import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ChatCompletionsApiInterface } from '@sre/LLMManager/LLM.service/connectors/openai/apiInterfaces/ChatCompletionsApiInterface';
import { TLLMParams, ILLMRequestContext, TLLMMessageRole } from '@sre/types/LLM.types';

describe('ChatCompletionsApiInterface - Unit Tests', () => {
    let apiInterface: ChatCompletionsApiInterface;
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
            isUserKey: true,
            toolsInfo: undefined,
            modelInfo: { name: 'gpt-4o', provider: 'openai' },
            credentials: { apiKey: 'test-key', isUserKey: true },
        };

        apiInterface = new ChatCompletionsApiInterface(mockContext, mockDeps);
    });

    describe('transformToolsConfig', () => {
        it('should transform tool definitions to OpenAI ChatCompletion format', () => {
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
                modelInfo: { name: 'gpt-4o', provider: 'openai' },
            };

            const result = apiInterface.transformToolsConfig(toolConfig);

            expect(result).toEqual([
                {
                    type: 'function',
                    function: {
                        name: 'get_weather',
                        description: 'Get weather information',
                        parameters: {
                            type: 'object',
                            properties: {
                                location: { type: 'string', description: 'Location name' },
                            },
                            required: ['location'],
                        },
                    },
                },
            ]);
        });

        it('should handle tool definitions without explicit parameters', () => {
            const toolConfig = {
                type: 'function' as const,
                toolDefinitions: [
                    {
                        name: 'simple_tool',
                        description: 'A simple tool',
                        properties: {
                            input: { type: 'string' },
                        },
                        requiredFields: ['input'],
                    },
                ],
                toolChoice: 'auto' as const,
                modelInfo: { name: 'gpt-4o', provider: 'openai' },
            };

            const result = apiInterface.transformToolsConfig(toolConfig);

            expect(result[0].function.parameters).toEqual({
                type: 'object',
                properties: {
                    input: { type: 'string' },
                },
                required: ['input'],
            });
        });

        it('should handle empty tool definitions', () => {
            const toolConfig = {
                type: 'function' as const,
                toolDefinitions: [],
                toolChoice: 'auto' as const,
                modelInfo: { name: 'gpt-4o', provider: 'openai' },
            };

            const result = apiInterface.transformToolsConfig(toolConfig);

            expect(result).toEqual([]);
        });
    });

    describe('validateParameters', () => {
        it('should return true for valid parameters', () => {
            const validParams: TLLMParams = {
                model: 'gpt-4o',
                messages: [{ role: TLLMMessageRole.User, content: 'Hello' }],
                agentId: 'test-agent',
            };

            const result = apiInterface.validateParameters(validParams);

            expect(result).toBe(true);
        });

        it('should return false when model is missing', () => {
            const invalidParams = {
                messages: [{ role: TLLMMessageRole.User, content: 'Hello' }],
                agentId: 'test-agent',
            } as TLLMParams;

            const result = apiInterface.validateParameters(invalidParams);

            expect(result).toBe(false);
        });

        it('should return false when messages is not an array', () => {
            const invalidParams = {
                model: 'gpt-4o',
                messages: 'not an array',
                agentId: 'test-agent',
            } as any;

            const result = apiInterface.validateParameters(invalidParams);

            expect(result).toBe(false);
        });

        it('should return false when messages is missing', () => {
            const invalidParams = {
                model: 'gpt-4o',
                agentId: 'test-agent',
            } as TLLMParams;

            const result = apiInterface.validateParameters(invalidParams);

            expect(result).toBe(false);
        });
    });

    describe('getInterfaceName', () => {
        it('should return correct interface name', () => {
            const result = apiInterface.getInterfaceName();
            expect(result).toBe('chat.completions');
        });
    });

    describe('prepareRequestBody', () => {
        it('should map basic parameters correctly', async () => {
            const params: TLLMParams = {
                model: 'gpt-4o',
                messages: [{ role: TLLMMessageRole.User, content: 'Hello' }],
                maxTokens: 100,
                temperature: 0.7,
                topP: 0.9,
                agentId: 'test-agent',
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result).toEqual({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'Hello' }],
                max_completion_tokens: 100,
                temperature: 0.7,
                top_p: 0.9,
            });
        });

        it('should map frequency and presence penalty', async () => {
            const params: TLLMParams = {
                model: 'gpt-4o',
                messages: [{ role: TLLMMessageRole.User, content: 'Hello' }],
                frequencyPenalty: 0.5,
                presencePenalty: 0.3,
                agentId: 'test-agent',
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result).toEqual(
                expect.objectContaining({
                    frequency_penalty: 0.5,
                    presence_penalty: 0.3,
                })
            );
        });

        it('should map stop sequences', async () => {
            const params: TLLMParams = {
                model: 'gpt-4o',
                messages: [{ role: TLLMMessageRole.User, content: 'Hello' }],
                stopSequences: ['STOP', 'END'],
                agentId: 'test-agent',
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result).toEqual(
                expect.objectContaining({
                    stop: ['STOP', 'END'],
                })
            );
        });

        it('should handle tools configuration', async () => {
            const params: TLLMParams = {
                model: 'gpt-4o',
                messages: [{ role: TLLMMessageRole.User, content: 'Hello' }],
                toolsConfig: {
                    tools: [
                        {
                            type: 'function',
                            function: {
                                name: 'test_tool',
                                description: 'Test tool',
                                parameters: {
                                    type: 'object',
                                    properties: {
                                        input: { type: 'string' },
                                    },
                                    required: ['input'],
                                },
                            },
                        },
                    ],
                    tool_choice: 'auto',
                },
                agentId: 'test-agent',
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result).toEqual(
                expect.objectContaining({
                    tools: expect.arrayContaining([
                        expect.objectContaining({
                            type: 'function',
                            function: expect.objectContaining({
                                name: 'test_tool',
                            }),
                        }),
                    ]),
                    tool_choice: 'auto',
                })
            );
        });

        it('should not include undefined parameters', async () => {
            const params: TLLMParams = {
                model: 'gpt-4o',
                messages: [{ role: TLLMMessageRole.User, content: 'Hello' }],
                agentId: 'test-agent',
                // maxTokens, temperature, etc. are undefined
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result).toEqual({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'Hello' }],
            });

            // Ensure undefined parameters are not present
            expect(result).not.toHaveProperty('max_completion_tokens');
            expect(result).not.toHaveProperty('temperature');
            expect(result).not.toHaveProperty('top_p');
        });
    });

    describe('JSON Response Format Handling', () => {
        it('should add JSON instruction to system message when responseFormat is json', async () => {
            const params: TLLMParams = {
                model: 'gpt-4o',
                messages: [
                    { role: TLLMMessageRole.System, content: 'You are a helpful assistant.' },
                    { role: TLLMMessageRole.User, content: 'Return JSON' },
                ],
                responseFormat: 'json',
                agentId: 'test-agent',
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result.messages[0].content).toContain('You are a helpful assistant.');
            expect(result.messages[0].content).toContain('Respond ONLY with a valid, parsable JSON object');
        });

        it('should create system message when none exists and responseFormat is json', async () => {
            const params: TLLMParams = {
                model: 'gpt-4o',
                messages: [{ role: TLLMMessageRole.User, content: 'Return JSON' }],
                responseFormat: 'json',
                agentId: 'test-agent',
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result.messages).toHaveLength(2);
            expect(result.messages[0].role).toBe('system');
            expect(result.messages[0].content).toContain('Respond ONLY with a valid, parsable JSON object');
        });
    });

    describe('Message Preparation', () => {
        it('should handle empty files array', async () => {
            const params: TLLMParams = {
                model: 'gpt-4o',
                messages: [{ role: TLLMMessageRole.User, content: 'Hello' }],
                files: [],
                agentId: 'test-agent',
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result.messages).toEqual([{ role: 'user', content: 'Hello' }]);
        });

        it('should handle missing files property', async () => {
            const params: TLLMParams = {
                model: 'gpt-4o',
                messages: [{ role: TLLMMessageRole.User, content: 'Hello' }],
                agentId: 'test-agent',
            };

            const result = await apiInterface.prepareRequestBody(params);

            expect(result.messages).toEqual([{ role: 'user', content: 'Hello' }]);
        });
    });

    describe('Error Cases', () => {
        it('should handle malformed tool configuration gracefully', () => {
            const toolConfig = {
                type: 'function' as const,
                toolDefinitions: [
                    {
                        // Missing name, description, etc.
                    } as any,
                ],
                toolChoice: 'auto' as const,
                modelInfo: { name: 'gpt-4o', provider: 'openai' },
            };

            const result = apiInterface.transformToolsConfig(toolConfig);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'function',
                function: {
                    name: undefined,
                    description: undefined,
                    parameters: {
                        type: 'object',
                        properties: undefined,
                        required: undefined,
                    },
                },
            });
        });
    });
});
