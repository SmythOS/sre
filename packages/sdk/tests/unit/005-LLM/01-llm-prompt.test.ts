// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LLM, LLMInstance } from '../../../src';

// Mock @smythos/sre dependencies used by LLMInstance
vi.mock('@smythos/sre', async () => {
    const EventEmitter = (await import('events')).EventEmitter;
    class DummyRequester {
        constructor(public candidate?: any) {}
        async request(params: any) {
            // Return a deterministic response with finishReason stop
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
        TLLMProvider: { OpenAI: 'OpenAI' },
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
                                    'gpt-4o': { tokens: 128000, completionTokens: 8192, keyOptions: {} },
                                    'gpt-4o-mini': { tokens: 128000, completionTokens: 8192, keyOptions: {} },
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

describe('LLM - prompt and model adaptation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates LLM via factory with model string and prompts', async () => {
        const llm = LLM.OpenAI('gpt-4o', { temperature: 0.2 });
        const res = await llm.prompt('What is the capital of France?');
        expect(res).toContain('Echo:');
        expect(typeof res).toBe('string');
    });

    it('creates LLM via factory with params object and prompts', async () => {
        const llm = LLM.OpenAI({ model: 'gpt-4o-mini', maxTokens: 100 });
        const res = await llm.prompt('Say hi');
        expect(res).toContain('Echo: Say hi');
    });

    it('LLMInstance works directly and emits error when finishReason not stop', async () => {
        // Override request to simulate non-stop finishReason
        const { ConnectorService } = await import('@smythos/sre');
        const original = ConnectorService.getLLMConnector;
        ConnectorService.getLLMConnector = () =>
            ({
                user() {
                    return {
                        async request() {
                            return { content: 'partial', finishReason: 'length' } as any;
                        },
                    } as any;
                },
            } as any);

        const llm = new LLMInstance('OpenAI' as any, { model: 'gpt-4o' });
        const onError = vi.fn();
        llm.on('error', onError);
        const res = await llm.prompt('test');
        expect(res).toBe('partial');
        expect(onError).toHaveBeenCalled();

        ConnectorService.getLLMConnector = original; // restore
    });
});
