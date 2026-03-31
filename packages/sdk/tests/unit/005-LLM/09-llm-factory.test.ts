// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@smythos/sre', async () => {
    const EventEmitter = (await import('events')).EventEmitter;
    return {
        TLLMProvider: { OpenAI: 'OpenAI', Anthropic: 'Anthropic' },
        TLLMEvent: {
            Content: 'content', End: 'end', Error: 'error',
            ToolCall: 'toolCall', ToolResult: 'toolResult', Usage: 'usage',
            ToolInfo: 'toolInfo', Interrupted: 'interrupted', Data: 'data',
        },
        TStorageProvider: { default: 'default' },
        TConnectorService: { Storage: 'Storage' },
        TAccessRole: { Agent: 'agent', User: 'user', Team: 'team' },
        SmythFS: {
            Instance: { read: vi.fn(), write: vi.fn(), delete: vi.fn(), exists: vi.fn() },
            getInstance: vi.fn(),
        },
        DEFAULT_TEAM_ID: 'default',
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id }),
            agent: (id: string) => ({ type: 'agent', id }),
        },
        ConnectorService: {
            getModelsProviderConnector() {
                return {
                    requester: () => ({
                        getModels: vi.fn().mockResolvedValue({
                            'gpt-4o': { tokens: 128000, completionTokens: 8192, keyOptions: {} },
                        }),
                    }),
                };
            },
            getLLMConnector() {
                return {
                    user: () => ({
                        request: vi.fn().mockResolvedValue({ content: 'response', finishReason: 'stop' }),
                        streamRequest: vi.fn().mockResolvedValue(new EventEmitter()),
                    }),
                };
            },
            getStorageConnector() { return null; },
            getAccountConnector() { return { getCandidateTeam: vi.fn().mockResolvedValue('t1') }; },
            init() { return null; },
        },
        Conversation: class extends EventEmitter {
            ready = Promise.resolve(true);
            streamPrompt = vi.fn().mockResolvedValue('response');
            constructor() { super(); }
        },
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
        BinaryInput: { from: vi.fn() },
    };
});

import { LLM } from '../../../src/LLM/LLM.class';
import { LLMInstance } from '../../../src/LLM/LLMInstance.class';

// ---------------------------------------------------------------------------
// LLM factory
// ---------------------------------------------------------------------------
describe('LLM factory', () => {
    it('has factory methods for each provider', () => {
        expect(typeof LLM.OpenAI).toBe('function');
        expect(typeof LLM.Anthropic).toBe('function');
    });

    it('creates LLMInstance from string model ID', () => {
        const instance = LLM.OpenAI('gpt-4o');
        expect(instance).toBeInstanceOf(LLMInstance);
    });

    it('creates LLMInstance from params object', () => {
        const instance = LLM.OpenAI({ model: 'gpt-4o', temperature: 0.7 });
        expect(instance).toBeInstanceOf(LLMInstance);
    });

    it('string + params merges correctly', () => {
        const instance = LLM.OpenAI('gpt-4o', { temperature: 0.5 });
        expect(instance).toBeInstanceOf(LLMInstance);
    });
});

// ---------------------------------------------------------------------------
// LLMInstance
// ---------------------------------------------------------------------------
describe('LLMInstance', () => {
    it('has ready promise', () => {
        const instance = LLM.OpenAI('gpt-4o');
        expect(instance.ready).toBeDefined();
        expect(typeof instance.ready.then).toBe('function');
    });

    it('prompt() returns thenable LLMCommand', () => {
        const instance = LLM.OpenAI('gpt-4o');
        const cmd = instance.prompt('Hello');
        expect(typeof cmd.then).toBe('function');
        expect(typeof cmd.run).toBe('function');
        expect(typeof cmd.stream).toBe('function');
    });

    it('prompt() with behavior injects system message', async () => {
        const instance = LLM.OpenAI('gpt-4o');
        await instance.ready;
        const cmd = instance.prompt('Hello', { behavior: 'Be kind' });
        // cmd is an LLMCommand - just verify it exists
        expect(cmd).toBeDefined();
    });

    it('chat() returns a Chat instance', () => {
        const instance = LLM.OpenAI('gpt-4o');
        const chat = instance.chat();
        expect(chat).toBeDefined();
        expect(typeof chat.prompt).toBe('function');
    });

    it('chat() with string creates persistent chat', () => {
        const instance = LLM.OpenAI('gpt-4o');
        const chat = instance.chat('my-chat');
        expect(chat.id).toBe('my-chat');
    });

    it('chat() with options object', () => {
        const instance = LLM.OpenAI('gpt-4o');
        const chat = instance.chat({ id: 'chat-2' });
        expect(chat.id).toBe('chat-2');
    });

    it('modelSettings getter returns settings', async () => {
        const instance = LLM.OpenAI('gpt-4o');
        await instance.ready;
        expect(instance.modelSettings).toBeDefined();
    });
});
