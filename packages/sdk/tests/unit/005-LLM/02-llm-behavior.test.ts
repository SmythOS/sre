// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LLM } from '../../../src';

// Extend the existing mock to assert behavior injection
vi.mock('@smythos/sre', async () => {
    const EventEmitter = (await import('events')).EventEmitter;
    class DummyRequester {
        async request(params: any) {
            const sys = params?.messages?.find((m: any) => m.role === 'system')?.content || '';
            const user = params?.messages?.find((m: any) => m.role === 'user')?.content || '';
            return { content: `${sys}${sys ? ' ' : ''}${user}`, finishReason: 'stop' } as any;
        }
        async streamRequest() {
            return new EventEmitter() as any;
        }
    }
    return {
        TLLMProvider: { OpenAI: 'OpenAI' },
        DEFAULT_TEAM_ID: 'default',
        AccessCandidate: { team: (id: string) => ({ type: 'team', id }) },
        ConnectorService: {
            getModelsProviderConnector() {
                return {
                    requester() {
                        return {
                            async getModels() {
                                return { 'gpt-4o-mini': { tokens: 128000, completionTokens: 8192, keyOptions: {} } } as any;
                            },
                        } as any;
                    },
                } as any;
            },
            getLLMConnector() {
                return {
                    user() {
                        return new DummyRequester() as any;
                    },
                } as any;
            },
        },
        BinaryInput: class {},
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
    } as any;
});

describe('LLM - behavior handling', () => {
    beforeEach(() => vi.clearAllMocks());

    it('applies behavior from model settings', async () => {
        const llm = LLM.OpenAI('gpt-4o-mini', { behavior: 'PREFIX>' });
        const res = await llm.prompt('Hello');
        expect(res.startsWith('PREFIX>')).toBeTruthy();
    });

    it('overrides behavior via prompt options', async () => {
        const llm = LLM.OpenAI('gpt-4o-mini', { behavior: 'BASE>' });
        const res = await llm.prompt('Hello', { behavior: 'OVERRIDE>' });
        expect(res.startsWith('OVERRIDE>')).toBeTruthy();
        expect(res).not.toContain('BASE> Hello');
    });
});
