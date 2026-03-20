// prettier-ignore-file
import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock state
// ---------------------------------------------------------------------------
const { mockGetJobs } = vi.hoisted(() => ({
    mockGetJobs: vi.fn().mockResolvedValue([]),
}));

vi.mock('@smythos/sre', async () => {
    return {
        DEFAULT_TEAM_ID: 'default',
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id, role: 'team' }),
            agent: (id: string) => ({ type: 'agent', id, role: 'agent' }),
        },
        ConnectorService: {
            getSchedulerConnector(providerId?: string) {
                return {
                    valid: true,
                    instance: () => ({
                        requester: () => ({
                            getJobs: mockGetJobs,
                            createJob: vi.fn(),
                            deleteJob: vi.fn(),
                            updateJob: vi.fn(),
                        }),
                    }),
                    settings: {},
                };
            },
            init() {
                return {
                    valid: true,
                    instance: () => ({
                        requester: () => ({
                            getJobs: mockGetJobs,
                            createJob: vi.fn(),
                            deleteJob: vi.fn(),
                            updateJob: vi.fn(),
                        }),
                    }),
                    settings: {},
                };
            },
            getModelsProviderConnector() { return null; },
            getLLMConnector() { return null; },
            getAccountConnector() { return { getCandidateTeam: vi.fn().mockResolvedValue('team-1') }; },
        },
        TConnectorService: { Scheduler: 'Scheduler' },
        TSchedulerProvider: { default: 'default', LocalScheduler: 'LocalScheduler' },
        TLLMProvider: { OpenAI: 'OpenAI' },
        TLLMEvent: {
            Content: 'content', End: 'end', Error: 'error',
            ToolCall: 'toolCall', ToolResult: 'toolResult', Usage: 'usage',
            ToolInfo: 'toolInfo', Interrupted: 'interrupted', Data: 'data',
        },
        TStorageProvider: { default: 'default' },
        TVectorDBProvider: { default: 'default' },
        TCacheProvider: { default: 'default' },
        TAccessRole: { Agent: 'agent', User: 'user', Team: 'team' },
        Scope: { TEAM: 'team', AGENT: 'agent' },
        SmythFS: { Instance: { read: vi.fn(), write: vi.fn(), delete: vi.fn(), exists: vi.fn() }, getInstance: vi.fn() },
        Conversation: class { ready = Promise.resolve(true); streamPrompt = vi.fn(); spec: any = null; },
        AgentProcess: { load: vi.fn() },
        AgentDataConnector: class {},
        DummyAccount: class {},
        BinaryInput: { from: vi.fn() },
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
    };
});

import { Scheduler } from '../../../src/Scheduler/Scheduler.class';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Scheduler factory', () => {
    it('has factory methods for each provider', () => {
        expect(typeof Scheduler.default).toBe('function');
        expect(typeof Scheduler.LocalScheduler).toBe('function');
    });

    it('creates SchedulerInstance from default()', () => {
        const instance = Scheduler.default();
        expect(instance).toBeDefined();
    });

    it('creates SchedulerInstance from LocalScheduler()', () => {
        const instance = Scheduler.LocalScheduler();
        expect(instance).toBeDefined();
    });

    it('passes settings through', () => {
        const instance = Scheduler.LocalScheduler({ customSetting: true });
        expect(instance).toBeDefined();
    });

    it('warns with agent-specific message for Scope.AGENT string', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        Scheduler.LocalScheduler({}, 'agent' as any);
        const msg = warnSpy.mock.calls[0]?.[0] || '';
        expect(msg).toContain('AccessCandidate.agent');
        warnSpy.mockRestore();
    });

    it('warns with team-specific message for Scope.TEAM string', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        Scheduler.LocalScheduler({}, 'team' as any);
        const msg = warnSpy.mock.calls[0]?.[0] || '';
        expect(msg).toContain('AccessCandidate.team');
        warnSpy.mockRestore();
    });

    it('accepts AccessCandidate directly as scope', () => {
        const candidate = { type: 'agent', id: 'a1', role: 'agent' } as any;
        const instance = Scheduler.LocalScheduler({}, candidate);
        expect(instance).toBeDefined();
    });

    it('extracts scope from settings object', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const instance = Scheduler.LocalScheduler({ scope: 'team' });
        expect(instance).toBeDefined();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});
