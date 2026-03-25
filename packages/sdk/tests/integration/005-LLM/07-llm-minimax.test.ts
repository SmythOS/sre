// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LLM, LLMInstance, TLLMEvent } from '../../../src';

// Mock @smythos/sre dependencies for integration-style tests
vi.mock('@smythos/sre', async () => {
    const EventEmitter = (await import('events')).EventEmitter;
    class DummyRequester {
        constructor(public candidate?: any) {}
        async request(params: any) {
            const userMsg = params?.messages?.find((m: any) => m.role === 'user')?.content || '';
            const sysMsg = params?.messages?.find((m: any) => m.role === 'system')?.content || '';
            return {
                content: (sysMsg ? sysMsg + ' ' : '') + `Echo: ${userMsg}`,
                finishReason: 'stop',
            } as any;
        }
        async streamRequest(params: any) {
            const emitter = new EventEmitter();
            setTimeout(() => {
                const userMsg = params?.messages?.find((m: any) => m.role === 'user')?.content || '';
                emitter.emit('content', 'Echo: ' + userMsg);
                emitter.emit('end');
            }, 0);
            return emitter as any;
        }
    }
    return {
        TLLMProvider: {
            OpenAI: 'OpenAI',
            MiniMax: 'MiniMax',
            Anthropic: 'Anthropic',
            GoogleAI: 'GoogleAI',
            DeepSeek: 'DeepSeek',
            Groq: 'Groq',
            TogetherAI: 'TogetherAI',
            Bedrock: 'Bedrock',
            VertexAI: 'VertexAI',
            xAI: 'xAI',
            Perplexity: 'Perplexity',
            Ollama: 'Ollama',
            Echo: 'Echo',
        },
        TLLMEvent: {
            Data: 'data',
            Content: 'content',
            Thinking: 'thinking',
            End: 'end',
            Abort: 'abort',
            Error: 'error',
            ToolInfo: 'toolInfo',
            ToolCall: 'toolCall',
            ToolResult: 'toolResult',
            Usage: 'usage',
            Interrupted: 'interrupted',
            Fallback: 'fallback',
            Requested: 'requested',
        },
        DEFAULT_TEAM_ID: 'default',
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id }),
        },
        ConnectorService: {
            getModelsProviderConnector() {
                return {
                    requester() {
                        return {
                            async getModels() {
                                return {
                                    'MiniMax-M2.7': { tokens: 1000000, completionTokens: 16384, keyOptions: {} },
                                    'MiniMax-M2.7-highspeed': { tokens: 1000000, completionTokens: 16384, keyOptions: {} },
                                    'MiniMax-M2.5': { tokens: 204000, completionTokens: 16384, keyOptions: {} },
                                    'MiniMax-M2.5-highspeed': { tokens: 204000, completionTokens: 16384, keyOptions: {} },
                                } as any;
                            },
                        } as any;
                    },
                } as any;
            },
            getLLMConnector() {
                return {
                    user(candidate: any) {
                        return new DummyRequester(candidate) as any;
                    },
                } as any;
            },
        },
        BinaryInput: class {},
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
    } as any;
});

describe('LLM - MiniMax integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('MiniMax M2.7 prompt returns expected content', async () => {
        const llm = LLM.MiniMax('MiniMax-M2.7');
        const res = await llm.prompt('Tell me a joke');
        expect(res).toContain('Echo: Tell me a joke');
        expect(typeof res).toBe('string');
    });

    it('MiniMax M2.7-highspeed prompt returns expected content', async () => {
        const llm = LLM.MiniMax('MiniMax-M2.7-highspeed');
        const res = await llm.prompt('What is AI?');
        expect(res).toContain('Echo: What is AI?');
    });

    it('MiniMax M2.5 prompt returns expected content', async () => {
        const llm = LLM.MiniMax('MiniMax-M2.5');
        const res = await llm.prompt('Hello MiniMax');
        expect(res).toContain('Echo: Hello MiniMax');
    });

    it('MiniMax streaming works correctly', async () => {
        const llm = LLM.MiniMax('MiniMax-M2.7', { temperature: 0.7 });
        const streamEvents = await llm.prompt('Stream test').stream();

        return new Promise<void>((resolve, reject) => {
            let receivedContent = false;

            streamEvents.on('content', (content: string) => {
                expect(content).toContain('Echo: Stream test');
                receivedContent = true;
            });

            streamEvents.on('end', () => {
                expect(receivedContent).toBe(true);
                resolve();
            });

            streamEvents.on('error', (error: any) => {
                reject(error);
            });

            // Timeout safety
            setTimeout(() => {
                if (!receivedContent) {
                    reject(new Error('Streaming timed out'));
                }
            }, 5000);
        });
    });

    it('MiniMax with custom temperature and maxTokens', async () => {
        const llm = LLM.MiniMax('MiniMax-M2.5-highspeed', {
            temperature: 0.3,
            maxTokens: 500,
        });
        const res = await llm.prompt('Custom params test');
        expect(res).toContain('Echo: Custom params test');
    });
});
