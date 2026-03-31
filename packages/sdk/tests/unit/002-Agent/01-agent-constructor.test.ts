// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
const { mockSetEphemeralAgentData, mockGetModels } = vi.hoisted(() => ({
    mockSetEphemeralAgentData: vi.fn(),
    mockGetModels: vi.fn().mockResolvedValue({
        'gpt-4o': { tokens: 128000, completionTokens: 8192, keyOptions: {} },
    }),
}));

vi.mock('@smythos/sre', async () => {
    const EventEmitter = (await import('events')).EventEmitter;

    return {
        DEFAULT_TEAM_ID: 'default',
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id, role: 'team' }),
            agent: (id: string) => ({ type: 'agent', id, role: 'agent' }),
            user: (id: string) => ({ type: 'user', id, role: 'user' }),
        },
        ConnectorService: {
            getModelsProviderConnector() {
                return {
                    agent: () => ({ getModels: mockGetModels }),
                    requester: () => ({ getModels: mockGetModels }),
                };
            },
            getAgentDataConnector() {
                return { setEphemeralAgentData: mockSetEphemeralAgentData };
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
        AgentProcess: { load: vi.fn().mockReturnValue({ run: vi.fn().mockResolvedValue({ data: 'result' }) }) },
        AgentDataConnector: class {},
        DummyAccount: class DummyAccount {},
        BinaryInput: { from: vi.fn().mockReturnValue({ ready: vi.fn().mockResolvedValue(true), upload: vi.fn(), url: 'mock://file' }) },
        Conversation: class extends EventEmitter {
            ready = Promise.resolve(true);
            streamPrompt = vi.fn().mockResolvedValue('response');
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

import { Agent, TAgentMode } from '../../../src/Agent/Agent.class';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Agent - Constructor & ID handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Basic construction ──────────────────────────────────────────────

    it('creates an agent with name and model', () => {
        const agent = new Agent({ name: 'TestBot', model: 'gpt-4o' });
        expect(agent).toBeInstanceOf(Agent);
        expect(agent.data.name).toBe('TestBot');
    });

    it('generates a normalized ID when none provided', () => {
        const agent = new Agent({ name: 'Test Bot!', model: 'gpt-4o' });
        // normalized: lowercase, non-alnum replaced with hyphens
        expect(agent.id).toMatch(/^test-bot--[a-z0-9-]+$/);
        expect(agent.hasExplicitId).toBe(false);
    });

    it('generates ID without name prefix when name is empty', () => {
        const agent = new Agent({ name: '', model: 'gpt-4o' });
        expect(agent.id).toMatch(/^[a-z0-9-]+$/);
        expect(agent.id.length).toBeGreaterThan(0);
    });

    it('accepts a valid explicit ID', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'my-agent-123' });
        expect(agent.id).toBe('my-agent-123');
        expect(agent.hasExplicitId).toBe(true);
    });

    it('accepts underscores in explicit IDs', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'my_agent_v2' });
        expect(agent.id).toBe('my_agent_v2');
    });

    it('throws on invalid explicit ID (special characters)', () => {
        expect(() => new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bad agent!' }))
            .toThrow('Invalid agent id');
    });

    it('generates new ID when empty string provided (falsy check)', () => {
        // Empty string is falsy, so the constructor generates a new ID
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: '' });
        expect(agent.id).not.toBe('');
        expect(agent.hasExplicitId).toBe(false);
    });

    it('throws on ID longer than 64 characters', () => {
        const longId = 'a'.repeat(65);
        expect(() => new Agent({ name: 'Bot', model: 'gpt-4o', id: longId }))
            .toThrow('Invalid agent id');
    });

    it('accepts ID exactly 64 characters', () => {
        const id64 = 'a'.repeat(64);
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: id64 });
        expect(agent.id).toBe(id64);
    });

    // ── Team ID ─────────────────────────────────────────────────────────

    it('uses DEFAULT_TEAM_ID when no teamId is provided', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
        expect(agent.data.teamId).toBe('default');
    });

    it('uses custom teamId when provided', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o', teamId: 'my-team' });
        expect(agent.data.teamId).toBe('my-team');
    });

    // ── Behavior ────────────────────────────────────────────────────────

    it('stores behavior from settings', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o', behavior: 'Be helpful' });
        expect(agent.behavior).toBe('Be helpful');
    });

    it('defaults behavior to empty string', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
        expect(agent.behavior).toBe('');
    });

    it('behavior setter updates the value', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
        agent.behavior = 'New behavior';
        expect(agent.behavior).toBe('New behavior');
    });

    // ── Mode handling ───────────────────────────────────────────────────

    it('starts with no modes by default', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
        expect(agent.modes).toEqual([]);
    });

    it('applies a single mode from constructor', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o', mode: TAgentMode.PLANNER });
        expect(agent.modes).toContain(TAgentMode.PLANNER);
    });

    it('applies multiple modes from array', () => {
        const agent = new Agent({
            name: 'Bot', model: 'gpt-4o',
            mode: [TAgentMode.PLANNER, TAgentMode.WORKER],
        });
        expect(agent.modes).toContain(TAgentMode.PLANNER);
        expect(agent.modes).toContain(TAgentMode.WORKER);
    });

    it('setMode adds a mode at runtime', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
        agent.setMode(TAgentMode.PLANNER);
        expect(agent.modes).toContain(TAgentMode.PLANNER);
    });

    it('unsetMode removes a mode', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o', mode: TAgentMode.PLANNER });
        agent.unsetMode(TAgentMode.PLANNER);
        expect(agent.modes).not.toContain(TAgentMode.PLANNER);
    });

    it('warns on invalid mode (no-op)', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
        agent.setMode('invalid_mode' as any);
        expect(agent.modes).not.toContain('invalid_mode');
        warnSpy.mockRestore();
    });

    it('warns on invalid unsetMode', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
        agent.unsetMode('invalid_mode' as any);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not a valid mode'));
        warnSpy.mockRestore();
    });

    // ── Data getter ─────────────────────────────────────────────────────

    it('data getter returns cloned agent data with components', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o', id: 'bot-1' });
        const data = agent.data;
        expect(data.name).toBe('Bot');
        expect(data.id).toBe('bot-1');
        expect(Array.isArray(data.components)).toBe(true);
        expect(Array.isArray(data.connections)).toBe(true);
    });

    it('data getter returns a new object each call (clone)', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
        const d1 = agent.data;
        const d2 = agent.data;
        expect(d1).not.toBe(d2);
        expect(d1.name).toBe(d2.name);
    });

    // ── Structure ───────────────────────────────────────────────────────

    it('structure getter returns components and connections', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
        expect(agent.structure).toHaveProperty('components');
        expect(agent.structure).toHaveProperty('connections');
    });

    it('structure setter triggers sync', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
        mockSetEphemeralAgentData.mockClear();
        agent.structure = { components: [], connections: [] };
        expect(mockSetEphemeralAgentData).toHaveBeenCalled();
    });

    // ── Team getter ─────────────────────────────────────────────────────

    it('team getter returns a Team instance', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
        const team = agent.team;
        expect(team).toBeDefined();
    });

    it('team getter returns same instance on repeated access (lazy)', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
        const t1 = agent.team;
        const t2 = agent.team;
        expect(t1).toBe(t2);
    });

    // ── Ready / init ────────────────────────────────────────────────────

    it('ready promise resolves', async () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
        const result = await agent.ready;
        expect(result).toBe(true);
    });

    it('has event emitter interface', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o' });
        expect(typeof agent.on).toBe('function');
        expect(typeof agent.off).toBe('function');
        expect(typeof agent.emit).toBe('function');
    });

    // ── Extra settings pass-through ─────────────────────────────────────

    it('passes through unknown settings into _data', () => {
        const agent = new Agent({ name: 'Bot', model: 'gpt-4o', customField: 'hello' } as any);
        expect(agent.data.customField).toBe('hello');
    });
});
