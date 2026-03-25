// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LLM, LLMInstance, Model } from '../../../src';

// Mock @smythos/sre dependencies used by LLMInstance
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

describe('LLM - MiniMax provider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates MiniMax LLM via factory with model string and prompts', async () => {
        const llm = LLM.MiniMax('MiniMax-M2.7', { temperature: 0.7 });
        expect(llm).toBeInstanceOf(LLMInstance);
        const res = await llm.prompt('What is the capital of France?');
        expect(res).toContain('Echo:');
        expect(typeof res).toBe('string');
    });

    it('creates MiniMax LLM via factory with params object and prompts', async () => {
        const llm = LLM.MiniMax({ model: 'MiniMax-M2.5', maxTokens: 100 });
        expect(llm).toBeInstanceOf(LLMInstance);
        const res = await llm.prompt('Say hi');
        expect(res).toContain('Echo: Say hi');
    });

    it('creates MiniMax M2.7-highspeed model instance', async () => {
        const llm = LLM.MiniMax('MiniMax-M2.7-highspeed');
        expect(llm).toBeInstanceOf(LLMInstance);
        const res = await llm.prompt('Hello');
        expect(res).toContain('Echo: Hello');
    });

    it('creates MiniMax M2.5-highspeed model instance', async () => {
        const llm = LLM.MiniMax('MiniMax-M2.5-highspeed', { temperature: 0.5 });
        expect(llm).toBeInstanceOf(LLMInstance);
        const res = await llm.prompt('Test');
        expect(res).toContain('Echo: Test');
    });

    it('applies behavior from model settings for MiniMax', async () => {
        const llm = LLM.MiniMax('MiniMax-M2.7', { behavior: 'PREFIX>' });
        const res = await llm.prompt('Hello');
        expect(res.startsWith('PREFIX>')).toBeTruthy();
    });

    it('overrides behavior via prompt options for MiniMax', async () => {
        const llm = LLM.MiniMax('MiniMax-M2.7', { behavior: 'BASE>' });
        const res = await llm.prompt('Hello', { behavior: 'OVERRIDE>' });
        expect(res.startsWith('OVERRIDE>')).toBeTruthy();
        expect(res).not.toContain('BASE> Hello');
    });

    it('creates MiniMax model via Model factory', () => {
        const model = Model.MiniMax('MiniMax-M2.7');
        expect(model).toBeDefined();
    });

    it('creates MiniMax model via Model factory with params', () => {
        const model = Model.MiniMax({ model: 'MiniMax-M2.5', temperature: 0.8 });
        expect(model).toBeDefined();
    });

    it('LLM.MiniMax exists as a factory function', () => {
        expect(typeof LLM.MiniMax).toBe('function');
    });

    it('Model.MiniMax exists as a factory function', () => {
        expect(typeof Model.MiniMax).toBe('function');
    });
});
