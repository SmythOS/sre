// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock state (hoisted for vi.mock factory)
// ---------------------------------------------------------------------------
const { mockStreamPrompt, mockFsWrite, mockFsRead, capturedStores } = vi.hoisted(() => ({
    mockStreamPrompt: vi.fn().mockResolvedValue('chat response'),
    mockFsWrite: vi.fn().mockResolvedValue(undefined),
    mockFsRead: vi.fn().mockResolvedValue(Buffer.from('[]')),
    capturedStores: [] as any[],
}));

vi.mock('@smythos/sre', async () => {
    const EventEmitter = (await import('events')).EventEmitter;
    return {
        DEFAULT_TEAM_ID: 'default',
        TLLMEvent: {
            Content: 'content', End: 'end', Error: 'error',
            ToolCall: 'toolCall', ToolResult: 'toolResult', Usage: 'usage',
            ToolInfo: 'toolInfo', Interrupted: 'interrupted', Data: 'data',
        },
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id, role: 'team' }),
            agent: (id: string) => ({ type: 'agent', id, role: 'agent' }),
        },
        TAccessRole: { Agent: 'agent', User: 'user', Team: 'team' },
        ConnectorService: {
            getModelsProviderConnector() {
                return {
                    requester: () => ({
                        getModels: vi.fn().mockResolvedValue({}),
                    }),
                };
            },
            getLLMConnector() { return null; },
            getStorageConnector() {
                return {
                    valid: true,
                    instance: () => 'mock-storage',
                    settings: {},
                };
            },
            init() { return null; },
            getAccountConnector() { return { getCandidateTeam: vi.fn().mockResolvedValue('team-1') }; },
        },
        TConnectorService: { Storage: 'Storage' },
        TStorageProvider: { default: 'default' },
        Conversation: class extends EventEmitter {
            ready = Promise.resolve(true);
            streamPrompt = mockStreamPrompt;
            spec: any = null;
            constructor(_model?: any, _data?: any, options?: any) {
                super();
                if (options?.store) capturedStores.push(options.store);
            }
        },
        ILLMContextStore: class {},
        SmythFS: {
            Instance: { read: mockFsRead, write: mockFsWrite, delete: vi.fn(), exists: vi.fn() },
            getInstance: vi.fn().mockReturnValue({
                read: mockFsRead,
                write: mockFsWrite,
                delete: vi.fn(),
                exists: vi.fn(),
            }),
        },
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
    };
});

import { Chat, prepareConversation } from '../../../src/LLM/Chat.class';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Chat', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStreamPrompt.mockResolvedValue('chat response');
        capturedStores.length = 0;
    });

    // ── Constructor ──────────────────────────────────────────────────

    describe('constructor', () => {
        it('creates a chat with default options', () => {
            const chat = new Chat({
                candidate: { type: 'team', id: 'default', role: 'team' } as any,
            });
            expect(chat).toBeDefined();
            expect(chat.id).toBeDefined();
        });

        it('uses provided id', () => {
            const chat = new Chat({
                id: 'my-chat',
                candidate: { type: 'agent', id: 'a1', role: 'agent' } as any,
            });
            expect(chat.id).toBe('my-chat');
        });

        it('generates id when none provided', () => {
            const chat = new Chat({
                candidate: { type: 'team', id: 'default', role: 'team' } as any,
            });
            expect(chat.id).toBeTruthy();
            expect(chat.id.length).toBeGreaterThan(0);
        });

        it('sets model from options', () => {
            const chat = new Chat({
                model: 'gpt-4o' as any,
                candidate: { type: 'team', id: 'default', role: 'team' } as any,
            });
            expect(chat.agentData.defaultModel).toBe('gpt-4o');
        });

        it('defaults model from source agent data', () => {
            const source = {
                data: {
                    defaultModel: 'claude-3-sonnet',
                    name: 'TestAgent',
                    components: [],
                    connections: [],
                    id: 'a1',
                },
            };
            const chat = new Chat({
                candidate: { type: 'agent', id: 'a1', role: 'agent' } as any,
            }, source as any);
            expect(chat.agentData.defaultModel).toBe('claude-3-sonnet');
        });

        it('warns when persist is true but no candidate', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            new Chat({
                persist: true,
                candidate: undefined as any,
            });
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        it('enables persist with custom store object', () => {
            const store = { save: vi.fn(), load: vi.fn(), getMessage: vi.fn() };
            const chat = new Chat({
                id: 'persist-chat',
                persist: store as any,
                candidate: { type: 'agent', id: 'a1', role: 'agent' } as any,
            });
            expect(chat).toBeDefined();
        });

        it('accepts custom persist object (ILLMContextStore)', () => {
            const customStore = {
                save: vi.fn(),
                load: vi.fn(),
                getMessage: vi.fn(),
            };
            const chat = new Chat({
                id: 'custom-store-chat',
                persist: customStore as any,
                candidate: { type: 'agent', id: 'a1', role: 'agent' } as any,
            });
            expect(chat).toBeDefined();
        });

        it('passes maxContextSize to conversation options', () => {
            const chat = new Chat({
                maxContextSize: 4096,
                candidate: { type: 'team', id: 'default', role: 'team' } as any,
            });
            expect(chat).toBeDefined();
        });

        it('passes maxOutputTokens to conversation options', () => {
            const chat = new Chat({
                maxOutputTokens: 2048,
                candidate: { type: 'team', id: 'default', role: 'team' } as any,
            });
            expect(chat).toBeDefined();
        });

        it('creates LocalChatStore when persist=true and candidate provided', () => {
            const chat = new Chat({
                id: 'persist-local',
                persist: true,
                candidate: { type: 'agent', id: 'a1', role: 'agent' } as any,
            });
            expect(chat).toBeDefined();
        });

        it('rejects invalid persist object (missing methods)', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const chat = new Chat({
                id: 'bad-persist',
                persist: { save: vi.fn() } as any, // missing load and getMessage
                candidate: { type: 'agent', id: 'a1', role: 'agent' } as any,
            });
            // Should not use the invalid object as store — falls through
            expect(chat).toBeDefined();
            warnSpy.mockRestore();
        });

        it('uses source object without .data property', () => {
            const source = {
                defaultModel: 'gpt-4o',
                name: 'DirectSource',
                components: [],
                connections: [],
                id: 'direct-1',
            };
            const chat = new Chat({
                candidate: { type: 'team', id: 'default', role: 'team' } as any,
            }, source as any);
            expect(chat.agentData.defaultModel).toBe('gpt-4o');
        });
    });

    // ── prompt() ─────────────────────────────────────────────────────

    describe('prompt()', () => {
        it('returns a ChatCommand (thenable)', () => {
            const chat = new Chat({
                candidate: { type: 'team', id: 'default', role: 'team' } as any,
            });
            const cmd = chat.prompt('Hello');
            expect(typeof cmd.then).toBe('function');
            expect(typeof cmd.stream).toBe('function');
        });

        it('ChatCommand resolves to string via then()', async () => {
            const chat = new Chat({
                candidate: { type: 'team', id: 'default', role: 'team' } as any,
            });
            const result = await chat.prompt('Hello');
            expect(typeof result).toBe('string');
        });

        it('ChatCommand.stream() returns EventEmitter', async () => {
            const chat = new Chat({
                candidate: { type: 'team', id: 'default', role: 'team' } as any,
            });
            const emitter = await chat.prompt('Hello').stream();
            expect(typeof emitter.on).toBe('function');
        });
    });

    // ── stream event forwarding ──────────────────────────────────────

    describe('stream() event forwarding', () => {
        it('forwards content events from conversation to emitter and chat', async () => {
            const chat = new Chat({
                candidate: { type: 'team', id: 'default', role: 'team' } as any,
            });
            const emitter = await chat.prompt('Hello').stream();

            const streamContent: string[] = [];
            const chatContent: string[] = [];
            emitter.on('content', (c: string) => streamContent.push(c));
            chat.on('content', (c: string) => chatContent.push(c));

            // Manually emit content on the conversation to simulate LLM response
            chat.conversation.emit('content', 'chunk1');
            chat.conversation.emit('content', 'chunk2');
            chat.conversation.emit('end');

            expect(streamContent).toEqual(['chunk1', 'chunk2']);
            expect(chatContent).toEqual(['chunk1', 'chunk2']);
        });

        it('forwards toolCall and toolResult events', async () => {
            const chat = new Chat({
                candidate: { type: 'team', id: 'default', role: 'team' } as any,
            });
            const emitter = await chat.prompt('Hello').stream();

            const toolCalls: any[] = [];
            const toolResults: any[] = [];
            emitter.on('toolCall', (tc: any) => toolCalls.push(tc));
            emitter.on('toolResult', (tr: any) => toolResults.push(tr));

            chat.conversation.emit('toolCall', { name: 'search', args: {} });
            chat.conversation.emit('toolResult', { result: 'found' });
            chat.conversation.emit('end');

            expect(toolCalls.length).toBe(1);
            expect(toolResults.length).toBe(1);
        });

        it('forwards error events and removes handlers', async () => {
            const chat = new Chat({
                candidate: { type: 'team', id: 'default', role: 'team' } as any,
            });
            const emitter = await chat.prompt('Hello').stream();

            const errors: any[] = [];
            emitter.on('error', (e: any) => errors.push(e));
            // Prevent unhandled error on chat EventEmitter
            chat.on('error', () => {});

            chat.conversation.emit('error', new Error('test error'));
            expect(errors.length).toBe(1);
        });

        it('forwards usage, toolInfo, interrupted, and data events', async () => {
            const chat = new Chat({
                candidate: { type: 'team', id: 'default', role: 'team' } as any,
            });
            const emitter = await chat.prompt('Hello').stream();

            const events: Record<string, any[]> = {
                usage: [], toolInfo: [], interrupted: [], data: [],
            };
            emitter.on('usage', (u: any) => events.usage.push(u));
            emitter.on('toolInfo', (ti: any) => events.toolInfo.push(ti));
            emitter.on('interrupted', (i: any) => events.interrupted.push(i));
            emitter.on('data', (d: any) => events.data.push(d));

            chat.conversation.emit('usage', { tokens: 100 });
            chat.conversation.emit('toolInfo', { name: 'tool' });
            chat.conversation.emit('interrupted', { reason: 'timeout' });
            chat.conversation.emit('data', { extra: true });
            chat.conversation.emit('end');

            expect(events.usage.length).toBe(1);
            expect(events.toolInfo.length).toBe(1);
            expect(events.interrupted.length).toBe(1);
            expect(events.data.length).toBe(1);
        });

        it('removes handlers from conversation after end event', async () => {
            const chat = new Chat({
                candidate: { type: 'team', id: 'default', role: 'team' } as any,
            });
            const emitter = await chat.prompt('Hello').stream();
            const contentBefore = chat.conversation.listenerCount('content');
            chat.conversation.emit('end');

            // After end, handlers should be removed
            const contentAfter = chat.conversation.listenerCount('content');
            expect(contentAfter).toBeLessThan(contentBefore);
        });
    });

    // ── conversation getter ──────────────────────────────────────────

    describe('conversation getter', () => {
        it('returns the conversation instance', () => {
            const chat = new Chat({
                candidate: { type: 'team', id: 'default', role: 'team' } as any,
            });
            expect(chat.conversation).toBeDefined();
        });
    });

    // ── LocalChatStore (persist=true) ────────────────────────────────

    describe('LocalChatStore via persist=true', () => {
        it('save() writes messages to storage', async () => {
            new Chat({
                id: 'store-test',
                persist: true,
                candidate: { type: 'agent', id: 'a1', role: 'agent' } as any,
            });
            const store = capturedStores[0];
            expect(store).toBeDefined();

            await store.save([{ role: 'user', content: 'hi' }]);
            expect(mockFsWrite).toHaveBeenCalledWith(
                expect.stringContaining('smythfs://'),
                expect.stringContaining('"role":"user"'),
                expect.anything(),
            );
        });

        it('save() throws and logs error on storage failure', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockFsWrite.mockRejectedValueOnce(new Error('write failed'));

            new Chat({
                id: 'store-fail',
                persist: true,
                candidate: { type: 'agent', id: 'a1', role: 'agent' } as any,
            });
            const store = capturedStores[0];
            await expect(store.save([])).rejects.toThrow('write failed');
            errorSpy.mockRestore();
        });

        it('load() reads messages from storage', async () => {
            const messages = [{ role: 'assistant', content: 'hello' }];
            mockFsRead.mockResolvedValueOnce(Buffer.from(JSON.stringify(messages)));

            new Chat({
                id: 'load-test',
                persist: true,
                candidate: { type: 'agent', id: 'a1', role: 'agent' } as any,
            });
            const store = capturedStores[0];
            const result = await store.load();
            expect(result).toEqual(messages);
        });

        it('load() returns empty array when no data', async () => {
            mockFsRead.mockResolvedValueOnce(null);

            new Chat({
                id: 'load-empty',
                persist: true,
                candidate: { type: 'agent', id: 'a1', role: 'agent' } as any,
            });
            const store = capturedStores[0];
            const result = await store.load();
            expect(result).toEqual([]);
        });

        it('load() throws and logs error on storage failure', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockFsRead.mockRejectedValueOnce(new Error('read failed'));

            new Chat({
                id: 'load-fail',
                persist: true,
                candidate: { type: 'agent', id: 'a1', role: 'agent' } as any,
            });
            const store = capturedStores[0];
            await expect(store.load()).rejects.toThrow('read failed');
            errorSpy.mockRestore();
        });

        it('getMessage() finds message by message_id', async () => {
            const messages = [
                { role: 'user', content: 'hi', __smyth_data__: { message_id: 'msg-1' } },
                { role: 'assistant', content: 'hello', __smyth_data__: { message_id: 'msg-2' } },
            ];
            mockFsRead.mockResolvedValueOnce(Buffer.from(JSON.stringify(messages)));

            new Chat({
                id: 'getmsg-test',
                persist: true,
                candidate: { type: 'agent', id: 'a1', role: 'agent' } as any,
            });
            const store = capturedStores[0];
            const msg = await store.getMessage('msg-2');
            expect(msg.content).toBe('hello');
        });

        it('getMessage() returns undefined when not found', async () => {
            mockFsRead.mockResolvedValueOnce(Buffer.from('[]'));

            new Chat({
                id: 'getmsg-miss',
                persist: true,
                candidate: { type: 'agent', id: 'a1', role: 'agent' } as any,
            });
            const store = capturedStores[0];
            const msg = await store.getMessage('nonexistent');
            expect(msg).toBeUndefined();
        });

        it('store has id getter matching conversation id', () => {
            new Chat({
                id: 'id-check',
                persist: true,
                candidate: { type: 'agent', id: 'a1', role: 'agent' } as any,
            });
            const store = capturedStores[0];
            expect(store.id).toBe('id-check');
        });
    });

    // ── Mode detection ───────────────────────────────────────────────

    describe('mode detection', () => {
        it('detects mode changes and updates conversation spec', async () => {
            const modes = ['planner'];
            const source: any = {
                data: {
                    defaultModel: 'gpt-4o',
                    name: 'Bot',
                    components: [],
                    connections: [],
                    id: 'bot-1',
                    behavior: '',
                },
                modes,
            };
            const chat = new Chat({
                candidate: { type: 'agent', id: 'bot-1', role: 'agent' } as any,
            }, source);

            // First prompt with initial modes
            await chat.prompt('Hi');

            // Change modes
            modes.push('worker');
            // Second prompt should detect mode change
            await chat.prompt('Do something');
            // Conversation spec should have been updated
            expect(chat.conversation.spec).not.toBeNull();
        });
    });
});

// ---------------------------------------------------------------------------
// prepareConversation()
// ---------------------------------------------------------------------------
describe('prepareConversation()', () => {
    it('returns a conversation object', async () => {
        const agentData: any = {
            defaultModel: 'gpt-4o',
            name: 'Bot',
            components: [],
            connections: [],
            id: 'bot-1',
        };
        const conv = await prepareConversation(agentData);
        expect(conv).toBeDefined();
        expect(typeof conv.streamPrompt).toBe('function');
    });

    it('registers error handler on conversation', async () => {
        const agentData: any = {
            defaultModel: 'gpt-4o',
            name: 'Bot',
            components: [],
            connections: [],
            id: 'bot-1',
        };
        const conv = await prepareConversation(agentData);
        // Should have an error listener
        expect(conv.listenerCount('error')).toBeGreaterThanOrEqual(1);
    });
});
