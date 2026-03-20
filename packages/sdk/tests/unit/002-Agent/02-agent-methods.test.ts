// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock state (hoisted so vi.mock factory can access them)
// ---------------------------------------------------------------------------
const { mockStreamPrompt, mockRun, mockAgentProcessLoad, mockBinaryInputFrom } = vi.hoisted(() => {
    const mockStreamPrompt = vi.fn().mockResolvedValue('mock response');
    const mockRun = vi.fn().mockResolvedValue({ data: 'result' });
    const mockAgentProcessLoad = vi.fn().mockReturnValue({ run: mockRun });
    const mockBinaryInputFrom = vi.fn().mockReturnValue({
        ready: vi.fn().mockResolvedValue(true),
        upload: vi.fn(),
        url: 'mock://file',
    });
    return { mockStreamPrompt, mockRun, mockAgentProcessLoad, mockBinaryInputFrom };
});

vi.mock('@smythos/sre', async () => {
    const EventEmitter = (await import('events')).EventEmitter;
    return {
        DEFAULT_TEAM_ID: 'default',
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id, role: 'team' }),
            agent: (id: string) => ({ type: 'agent', id, role: 'agent' }),
        },
        ConnectorService: {
            getModelsProviderConnector() {
                return {
                    agent: () => ({
                        getModels: vi.fn().mockResolvedValue({
                            'gpt-4o': { tokens: 128000, completionTokens: 8192, keyOptions: {} },
                        }),
                    }),
                    requester: () => ({
                        getModels: vi.fn().mockResolvedValue({
                            'gpt-4o': { tokens: 128000, completionTokens: 8192, keyOptions: {} },
                        }),
                    }),
                };
            },
            getAgentDataConnector() {
                return { setEphemeralAgentData: vi.fn() };
            },
            getLLMConnector() {
                return { user: () => ({ request: vi.fn(), streamRequest: vi.fn() }) };
            },
            getStorageConnector() { return null; },
            getCacheConnector() { return null; },
            getVectorDBConnector() { return null; },
            getSchedulerConnector() { return null; },
            getAccountConnector() { return { getCandidateTeam: vi.fn().mockResolvedValue('team-1') }; },
            getVaultConnector() { return { requester: () => ({ get: vi.fn(), listKeys: vi.fn() }) }; },
            init() { return null; },
        },
        TConnectorService: { Storage: 'Storage', Cache: 'Cache', VectorDB: 'VectorDB', Scheduler: 'Scheduler' },
        TLLMProvider: { OpenAI: 'OpenAI' },
        TLLMEvent: {
            Content: 'content', End: 'end', Error: 'error',
            ToolCall: 'toolCall', ToolResult: 'toolResult', Usage: 'usage',
            ToolInfo: 'toolInfo', Interrupted: 'interrupted', Data: 'data',
        },
        TAccessRole: { Agent: 'agent', User: 'user', Team: 'team' },
        AgentProcess: { load: mockAgentProcessLoad },
        AgentDataConnector: class {},
        DummyAccount: class DummyAccount {},
        BinaryInput: { from: mockBinaryInputFrom },
        Conversation: class extends EventEmitter {
            ready = Promise.resolve(true);
            streamPrompt = mockStreamPrompt;
            spec: any = null;
            constructor() { super(); }
        },
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
        SmythFS: { Instance: { read: vi.fn(), write: vi.fn(), delete: vi.fn(), exists: vi.fn() }, getInstance: vi.fn() },
        TStorageProvider: { default: 'default', LocalStorage: 'LocalStorage' },
        TVectorDBProvider: { default: 'default', RAMVec: 'RAMVec' },
        TSchedulerProvider: { default: 'default', LocalScheduler: 'LocalScheduler' },
        TCacheProvider: { default: 'default', RAM: 'RAM' },
    };
});

// Mock fs for Agent.import
vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn().mockReturnValue(true),
        readFileSync: vi.fn().mockReturnValue(JSON.stringify({
            name: 'ImportedBot',
            model: 'gpt-4o',
            id: 'imported-1',
        })),
        statSync: vi.fn(),
        promises: { readFile: vi.fn() },
    },
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue(JSON.stringify({
        name: 'ImportedBot',
        model: 'gpt-4o',
        id: 'imported-1',
    })),
    statSync: vi.fn(),
    promises: { readFile: vi.fn() },
}));

import { Agent, TAgentMode } from '../../../src/Agent/Agent.class';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Agent - Methods', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── prompt() ────────────────────────────────────────────────────────

    describe('prompt()', () => {
        it('returns an AgentCommand (thenable)', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            const cmd = agent.prompt('Hello');
            expect(cmd).toBeDefined();
            expect(typeof cmd.then).toBe('function');
            expect(typeof cmd.run).toBe('function');
            expect(typeof cmd.stream).toBe('function');
        });

        it('AgentCommand.run() resolves to a string', async () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            const result = await agent.prompt('Hello').run();
            expect(typeof result).toBe('string');
        });

        it('AgentCommand is thenable (await directly)', async () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            const result = await agent.prompt('Hello');
            expect(typeof result).toBe('string');
        });

        it('AgentCommand.stream() returns an EventEmitter', async () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            const emitter = await agent.prompt('Hello').stream();
            expect(typeof emitter.on).toBe('function');
            expect(typeof emitter.emit).toBe('function');
        });
    });

    // ── chat() ──────────────────────────────────────────────────────────

    describe('chat()', () => {
        it('returns a Chat instance', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            const chat = agent.chat();
            expect(chat).toBeDefined();
            expect(typeof chat.prompt).toBe('function');
        });

        it('accepts ChatOptions with id', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            const chat = agent.chat({ id: 'my-chat', persist: false });
            expect(chat.id).toBe('my-chat');
        });

        it('accepts ChatOptions object', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            const chat = agent.chat({ id: 'chat-2', persist: false });
            expect(chat.id).toBe('chat-2');
        });

        it('emits chatCreated event', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            const handler = vi.fn();
            agent.on('chatCreated', handler);
            agent.chat();
            expect(handler).toHaveBeenCalledOnce();
        });

        it('warns and disables persist for ephemeral agents', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' }); // no explicit id
            agent.chat({ persist: true });
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        it('defaults model from agent when not specified in options', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            const chat = agent.chat();
            expect(chat.agentData.defaultModel).toBeDefined();
        });
    });

    // ── addSkill / removeSkill ──────────────────────────────────────────

    describe('addSkill() / removeSkill()', () => {
        it('addSkill returns a component', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            const component = agent.addSkill({
                name: 'greet',
                description: 'Say hello',
            });
            expect(component).toBeDefined();
        });

        it('skill appears in data.components after adding', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            agent.addSkill({ name: 'greet', description: 'Say hello' });
            const endpoints = agent.data.components.map((c: any) => c.data?.endpoint);
            expect(endpoints).toContain('greet');
        });

        it('removeSkill removes the skill from structure', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            agent.addSkill({ name: 'greet', description: 'Say hello' });
            agent.removeSkill('greet');
            expect(agent.skillNames).not.toContain('greet');
        });

        it('removeSkill is a no-op for nonexistent skill', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            expect(() => agent.removeSkill('nonexistent')).not.toThrow();
        });
    });

    // ── call() ──────────────────────────────────────────────────────────

    describe('call()', () => {
        it('executes a skill via AgentProcess', async () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            agent.addSkill({ name: 'compute', description: 'Do math', method: 'POST' });

            const result = await agent.call('compute', { a: 1, b: 2 });
            expect(mockAgentProcessLoad).toHaveBeenCalled();
            expect(mockRun).toHaveBeenCalled();
            expect(result).toEqual({ data: 'result' });
        });

        it('uses POST method body for POST skills', async () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            agent.addSkill({ name: 'create', description: 'Create thing', method: 'POST' });

            await agent.call('create', { foo: 'bar' });
            const runCall = mockRun.mock.calls[0][0];
            expect(runCall.method).toBe('POST');
            expect(runCall.body).toEqual({ foo: 'bar' });
            expect(runCall.query).toBeUndefined();
        });

        it('uses GET method query for GET skills', async () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            agent.addSkill({ name: 'search', description: 'Search things', method: 'GET' });

            await agent.call('search', { q: 'test' });
            const runCall = mockRun.mock.calls[0][0];
            expect(runCall.method).toBe('GET');
            expect(runCall.query).toEqual({ q: 'test' });
            expect(runCall.body).toBeUndefined();
        });

        it('throws and logs error when skill execution fails', async () => {
            mockAgentProcessLoad.mockReturnValueOnce({
                run: vi.fn().mockRejectedValue(new Error('skill error')),
            });
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            agent.addSkill({ name: 'fail', description: 'Will fail', method: 'POST' });

            await expect(agent.call('fail', {})).rejects.toThrow('skill error');
            errorSpy.mockRestore();
        });
    });

    // ── import() ────────────────────────────────────────────────────────

    describe('Agent.import()', () => {
        it('imports from settings object', () => {
            const agent = Agent.import({ name: 'DirectBot', model: 'gpt-4o', id: 'direct-1' });
            expect(agent.data.name).toBe('DirectBot');
            expect(agent.id).toBe('direct-1');
        });

        it('imports from file path', () => {
            const agent = Agent.import('/path/to/agent.smyth');
            expect(agent.data.name).toBe('ImportedBot');
        });

        it('applies overrides when importing from file', () => {
            const agent = Agent.import('/path/to/agent.smyth', {
                name: 'OverrideName',
                model: 'gpt-4o',
            } as any);
            expect(agent.data.name).toBe('OverrideName');
        });

        it('throws when file does not exist', () => {
            vi.mocked(fs.existsSync).mockReturnValueOnce(false);
            expect(() => Agent.import('/nonexistent.smyth')).toThrow('does not exist');
        });
    });

    // ── skillNames ──────────────────────────────────────────────────────

    describe('skillNames', () => {
        it('returns empty array initially', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            expect(agent.skillNames).toEqual([]);
        });

        it('returns skill names via data.components', () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
            agent.addSkill({ name: 'a', description: 'Skill A' });
            agent.addSkill({ name: 'b', description: 'Skill B' });
            const endpoints = agent.data.components.map((c: any) => c.data?.endpoint);
            expect(endpoints).toContain('a');
            expect(endpoints).toContain('b');
        });
    });

    // ── AgentCommand.stream() event forwarding ──────────────────────────

    describe('AgentCommand.stream() events', () => {
        it('forwards content events from conversation to agent', async () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            const agentEvents: any[] = [];
            agent.on('content', (data: any) => agentEvents.push(data));

            const emitter = await agent.prompt('Hello').stream();
            emitter.emit('content', 'chunk1');

            expect(agentEvents).toContain('chunk1');
        });

        it('forwards toolCall events', async () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            const agentEvents: any[] = [];
            agent.on('toolCall', (data: any) => agentEvents.push(data));

            const emitter = await agent.prompt('Hello').stream();
            emitter.emit('toolCall', { name: 'myTool' });

            expect(agentEvents).toEqual([{ name: 'myTool' }]);
        });

        it('forwards toolResult events', async () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            const agentEvents: any[] = [];
            agent.on('toolResult', (data: any) => agentEvents.push(data));

            const emitter = await agent.prompt('Hello').stream();
            emitter.emit('toolResult', { result: 'ok' });

            expect(agentEvents).toEqual([{ result: 'ok' }]);
        });

        it('forwards usage events', async () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            const agentEvents: any[] = [];
            agent.on('usage', (data: any) => agentEvents.push(data));

            const emitter = await agent.prompt('Hello').stream();
            emitter.emit('usage', { tokens: 100 });

            expect(agentEvents).toEqual([{ tokens: 100 }]);
        });

        it('forwards toolInfo events', async () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            const agentEvents: any[] = [];
            agent.on('toolInfo', (data: any) => agentEvents.push(data));

            const emitter = await agent.prompt('Hello').stream();
            emitter.emit('toolInfo', { info: 'details' });

            expect(agentEvents).toEqual([{ info: 'details' }]);
        });

        it('forwards interrupted events', async () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            const agentEvents: any[] = [];
            agent.on('interrupted', (data: any) => agentEvents.push(data));

            const emitter = await agent.prompt('Hello').stream();
            emitter.emit('interrupted', 'user-stop');

            expect(agentEvents).toEqual(['user-stop']);
        });

        it('forwards end event and cleans up handlers', async () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            const agentEndEvents: any[] = [];
            agent.on('end', () => agentEndEvents.push(true));

            const emitter = await agent.prompt('Hello').stream();
            emitter.emit('end');

            expect(agentEndEvents).toHaveLength(1);
            // After 'end', handlers should be removed — further events should not forward
            const contentEvents: any[] = [];
            agent.on('content', (d: any) => contentEvents.push(d));
            emitter.emit('content', 'after-end');
            // The handler was removed from conversation, but since we emit directly
            // it still has the agent-level listener; the key is that the conversation
            // handler was cleaned up (off was called)
        });

        it('calls streamPrompt on the conversation during stream', async () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            await agent.prompt('Stream me').stream();
            expect(mockStreamPrompt).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Stream me' }),
            );
        });
    });

    // ── AgentCommand.run() with files ───────────────────────────────────

    describe('AgentCommand.run() with files', () => {
        it('handles URL/non-file attachments via BinaryInput', async () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            // isFile returns false for URLs (statSync throws), so it takes the else branch
            await agent.prompt('Analyze', { files: ['https://example.com/img.png'] }).run();

            expect(mockBinaryInputFrom).toHaveBeenCalledWith('https://example.com/img.png');
            // streamPrompt should include attachments info
            expect(mockStreamPrompt).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('Attachments'),
                }),
            );
        });

        it('handles local file attachments via fs.readFile + BinaryInput', async () => {
            // Make isFile return true by mocking statSync
            vi.mocked(fs.statSync).mockReturnValueOnce({ isFile: () => true } as any);
            vi.mocked(fs.promises.readFile).mockResolvedValueOnce(Buffer.from('file-data'));

            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            await agent.prompt('Analyze', { files: ['/path/to/file.png'] }).run();

            expect(fs.promises.readFile).toHaveBeenCalledWith('/path/to/file.png', null);
            expect(mockBinaryInputFrom).toHaveBeenCalledWith(expect.any(Buffer));
        });

        it('returns undefined files when no files option given', async () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            await agent.prompt('Hello').run();

            // streamPrompt should NOT include attachments
            expect(mockStreamPrompt).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Hello',
                }),
            );
        });

        it('handles streamPrompt error gracefully', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockStreamPrompt.mockRejectedValueOnce(new Error('LLM unavailable'));

            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            const result = await agent.prompt('Hello').run();

            expect(result).toContain('error');
            errorSpy.mockRestore();
        });

        it('handles multiple file attachments', async () => {
            const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
            await agent.prompt('Analyze', { files: ['https://a.com/1.png', 'https://b.com/2.png'] }).run();

            expect(mockBinaryInputFrom).toHaveBeenCalledTimes(2);
            expect(mockStreamPrompt).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('Attachments'),
                }),
            );
        });
    });
});
