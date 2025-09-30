// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LLM } from '../../../src';

vi.mock('@smythos/sre', async () => {
    const { EventEmitter } = await import('events');
    class DummyRequester {
        async request() {
            return { content: 'partial', finishReason: 'length' } as any;
        }
        async streamRequest() {
            const emitter = new EventEmitter();
            setTimeout(() => {
                emitter.emit('error', new Error('stream error'));
            }, 0);
            return emitter as any;
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
                                return { 'gpt-4o': {} } as any;
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

describe('LLM - error handling', () => {
    beforeEach(() => vi.clearAllMocks());

    it('emits error when finishReason is not stop or end_turn', async () => {
        const llm = LLM.OpenAI({ model: 'gpt-4o' });
        const onError = vi.fn();
        llm.on('error', onError);
        const res = await llm.prompt('hi');
        expect(res).toBe('partial');
        expect(onError).toHaveBeenCalled();
    });

    it('stream emits error event', async () => {
        const llm = LLM.OpenAI({ model: 'gpt-4o' });
        const stream = await llm.prompt('x').stream();
        await new Promise<void>((resolve) => {
            stream.on('error', () => resolve());
        });
        // if we reached here, error was emitted
        expect(true).toBe(true);
    });
});
