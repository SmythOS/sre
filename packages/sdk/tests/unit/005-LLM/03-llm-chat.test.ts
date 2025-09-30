// prettier-ignore-file
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

let SDK: any;

// Mock Conversation and storage to test persistence and event wiring
vi.mock('@smythos/sre', async () => {
    const { EventEmitter } = await import('events');
    class ConversationMock extends EventEmitter {
        defaultModel: any;
        filteredAgentData: any;
        options: any;
        ready: Promise<void>;
        constructor(model: any, data: any, options: any) {
            super();
            this.defaultModel = model;
            this.filteredAgentData = data;
            this.options = options;
            this.ready = Promise.resolve();
        }
        async streamPrompt(message: any) {
            // emit content and end asynchronously to allow consumers to attach listeners
            const content = typeof message === 'string' ? message : message?.message || '';
            setTimeout(() => {
                this.emit('content', 'R:' + content);
                this.emit('end');
            }, 25);
            return 'R:' + content;
        }
        async addTool() {}
    }

    class StorageInstanceMock {
        store = new Map<string, string>();
        constructor() {}
        async write(key: string, value: string) {
            this.store.set(key, value);
        }
        async read(key: string) {
            return Buffer.from(this.store.get(key) || '');
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
                                return { 'gpt-4o': { tokens: 128000, completionTokens: 8192 } } as any;
                            },
                        } as any;
                    },
                } as any;
            },
            getLLMConnector() {
                return {
                    user() {
                        return {
                            async request() {
                                return { content: 'ok', finishReason: 'stop' } as any;
                            },
                            async streamRequest() {
                                return new EventEmitter() as any;
                            },
                        } as any;
                    },
                } as any;
            },
        },
        Conversation: ConversationMock,
        TLLMEvent: {
            Content: 'content',
            End: 'end',
            Error: 'error',
            ToolCall: 'toolCall',
            ToolResult: 'toolResult',
            Usage: 'usage',
            ToolInfo: 'toolInfo',
            Interrupted: 'interrupted',
            Data: 'data',
        },
        StorageInstance: StorageInstanceMock,
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
    } as any;
});

describe('LLM - chat session', () => {
    beforeEach(() => vi.clearAllMocks());

    beforeAll(async () => {
        SDK = await import('../../../src');
    });

    it('creates a chat and preserves context across prompts', async () => {
        const llm = SDK.LLM.OpenAI({ model: 'gpt-4o' });
        const chat = llm.chat();
        const r1 = await chat.prompt('Hello');
        expect(r1).toBe('R:Hello');
        const r2 = await chat.prompt('World');
        expect(r2).toBe('R:World');
    });

    it('streams events to consumer and to chat object', async () => {
        vi.useFakeTimers();
        try {
            const llm = SDK.LLM.OpenAI({ model: 'gpt-4o' });
            const chat = llm.chat();
            const stream = await chat.prompt('stream this').stream();

            let streamContent = '';
            let chatContent = '';

            stream.on('content', (c: string) => {
                streamContent += c;
            });
            (chat as any).on('content', (c: string) => {
                chatContent += c;
            });

            await vi.advanceTimersByTimeAsync(50);

            expect(streamContent).toContain('R:stream this');
            expect(chatContent).toContain('R:stream this');
        } finally {
            vi.useRealTimers();
        }
    });
});
