// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LLM } from '../../../src';

vi.mock('@smythos/sre', async () => {
    const { EventEmitter } = await import('events');
    class DummyRequester {
        async request() {
            return { content: 'ok', finishReason: 'stop' } as any;
        }
        async streamRequest(params: any) {
            const emitter = new EventEmitter();
            const userMsg = params?.messages?.find((m: any) => m.role === 'user')?.content || '';
            setTimeout(() => {
                emitter.emit('content', 'A');
                emitter.emit('content', 'B');
                emitter.emit('content', ':' + userMsg);
                emitter.emit('end');
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

describe('LLM - streaming', () => {
    beforeEach(() => vi.clearAllMocks());

    it('streams content and ends', async () => {
        const llm = LLM.OpenAI({ model: 'gpt-4o' });
        const stream = await llm.prompt('Hello').stream();
        let acc = '';
        await new Promise<void>((resolve, reject) => {
            stream.on('content', (c: string) => {
                acc += c;
            });
            stream.on('end', () => resolve());
            stream.on('error', reject);
        });
        expect(acc).toBe('AB:Hello');
    });
});
