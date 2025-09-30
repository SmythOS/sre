// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LLM } from '../../../src';

vi.mock('@smythos/sre', async () => {
    const { EventEmitter } = await import('events');
    class DummyRequester {
        async request(params: any) {
            const files = params?.files || [];
            return { content: `Files: ${files.length}`, finishReason: 'stop' } as any;
        }
        async streamRequest() {
            return new EventEmitter() as any;
        }
    }
    class BinaryInputMock {
        static from(input: any) {
            return { src: input, async ready() {} };
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
        BinaryInput: BinaryInputMock,
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
    } as any;
});

// Stub isFile: true for local paths, false for URLs
vi.mock('../../../src/utils/general.utils', async () => {
    const mod = await vi.importActual<any>('../../../src/utils/general.utils');
    return {
        ...mod,
        isFile: (p: string) => !/^https?:/i.test(p),
    };
});

describe('LLM - attachments', () => {
    beforeEach(() => vi.clearAllMocks());

    it('passes URL attachments to requester as BinaryInput array', async () => {
        const llm = LLM.OpenAI({ model: 'gpt-4o' });
        const res = await llm.prompt('Describe', { files: ['https://example.com/image.png'] });
        expect(res).toBe('Files: 1');
    });

    it('passes local file attachments (single) to requester', async () => {
        const llm = LLM.OpenAI({ model: 'gpt-4o' });
        const res = await llm.prompt('Describe', {
            files: ['./packages/sdk/tests/data/images/the-starry-night-mini.png'],
        });
        expect(res).toBe('Files: 1');
    });

    it('passes multiple local file attachments to requester', async () => {
        const llm = LLM.OpenAI({ model: 'gpt-4o' });
        const res = await llm.prompt('Describe', {
            files: ['./packages/sdk/tests/data/images/the-starry-night-mini.png', './packages/sdk/tests/data/images/the-starry-night.jpg'],
        });
        expect(res).toBe('Files: 2');
    });
});
