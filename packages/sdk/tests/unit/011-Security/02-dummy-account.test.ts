// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetAccountConnector, MockDummyAccount } = vi.hoisted(() => {
    class MockDummyAccount {
        data: Record<string, any> = {};
    }
    const mockGetAccountConnector = vi.fn();
    return { mockGetAccountConnector, MockDummyAccount };
});

vi.mock('@smythos/sre', async () => {
    return {
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id }),
            agent: (id: string) => ({ type: 'agent', id }),
        },
        DEFAULT_TEAM_ID: 'default',
        ConnectorService: {
            getAccountConnector: mockGetAccountConnector,
            getStorageConnector: vi.fn().mockReturnValue(null),
            getCacheConnector: vi.fn().mockReturnValue(null),
            getVectorDBConnector: vi.fn().mockReturnValue(null),
            getSchedulerConnector: vi.fn().mockReturnValue(null),
            getModelsProviderConnector: vi.fn().mockReturnValue(null),
            getLLMConnector: vi.fn().mockReturnValue(null),
            init: vi.fn(),
        },
        TConnectorService: { Storage: 'Storage', Cache: 'Cache', Scheduler: 'Scheduler', VectorDB: 'VectorDB' },
        TLLMProvider: { OpenAI: 'OpenAI' },
        TStorageProvider: {},
        TVectorDBProvider: {},
        TSchedulerProvider: {},
        BinaryInput: class {},
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
        DummyAccount: MockDummyAccount,
    };
});

import { DummyAccountHelper } from '../../../src/Security/DummyAccount.helper';

describe('DummyAccountHelper', () => {
    let dummyConnector: InstanceType<typeof MockDummyAccount>;

    beforeEach(() => {
        vi.clearAllMocks();
        dummyConnector = new MockDummyAccount();
        mockGetAccountConnector.mockReturnValue(dummyConnector);
    });

    // ── addAgentToTeam ────────────────────────────────────────────────

    describe('addAgentToTeam', () => {
        it('creates team entry if team does not exist', () => {
            DummyAccountHelper.addAgentToTeam('agent-1', 'team-new');

            expect(dummyConnector.data['team-new']).toBeDefined();
            expect(dummyConnector.data['team-new'].users).toEqual({});
            expect(dummyConnector.data['team-new'].agents).toBeDefined();
            expect(dummyConnector.data['team-new'].settings).toEqual({});
        });

        it('creates agent entry under existing team', () => {
            DummyAccountHelper.addAgentToTeam('agent-1', 'team-a');

            expect(dummyConnector.data['team-a'].agents['agent-1']).toEqual({ settings: {} });
        });

        it('does not overwrite existing team data when adding agent', () => {
            dummyConnector.data['team-pre'] = {
                users: { 'user-existing': { settings: { role: 'admin' } } },
                agents: {},
                settings: { billing: 'pro' },
            };

            DummyAccountHelper.addAgentToTeam('agent-new', 'team-pre');

            expect(dummyConnector.data['team-pre'].users['user-existing']).toEqual({ settings: { role: 'admin' } });
            expect(dummyConnector.data['team-pre'].settings).toEqual({ billing: 'pro' });
            expect(dummyConnector.data['team-pre'].agents['agent-new']).toEqual({ settings: {} });
        });

        it('returns existing agent data if agent already exists', () => {
            dummyConnector.data['team-x'] = {
                users: {},
                agents: { 'agent-old': { settings: { priority: 'high' } } },
                settings: {},
            };

            const result = DummyAccountHelper.addAgentToTeam('agent-old', 'team-x');

            expect(result).toEqual({ settings: { priority: 'high' } });
            // Should be the same reference, not a copy
            expect(result).toBe(dummyConnector.data['team-x'].agents['agent-old']);
        });

        it('returns the newly created agent data object', () => {
            const result = DummyAccountHelper.addAgentToTeam('agent-new', 'team-ret');

            expect(result).toEqual({ settings: {} });
            expect(result).toBe(dummyConnector.data['team-ret'].agents['agent-new']);
        });

        it('returns undefined if connector is not a DummyAccount', () => {
            mockGetAccountConnector.mockReturnValue({ data: {} }); // plain object, not instanceof DummyAccount

            const result = DummyAccountHelper.addAgentToTeam('agent-1', 'team-1');

            expect(result).toBeUndefined();
        });

        it('can add multiple agents to the same team', () => {
            DummyAccountHelper.addAgentToTeam('agent-1', 'team-multi');
            DummyAccountHelper.addAgentToTeam('agent-2', 'team-multi');
            DummyAccountHelper.addAgentToTeam('agent-3', 'team-multi');

            const agents = dummyConnector.data['team-multi'].agents;
            expect(Object.keys(agents)).toHaveLength(3);
            expect(agents['agent-1']).toEqual({ settings: {} });
            expect(agents['agent-2']).toEqual({ settings: {} });
            expect(agents['agent-3']).toEqual({ settings: {} });
        });
    });

    // ── addUserToTeam ─────────────────────────────────────────────────

    describe('addUserToTeam', () => {
        it('creates team entry if team does not exist', () => {
            DummyAccountHelper.addUserToTeam('user-1', 'team-new');

            expect(dummyConnector.data['team-new']).toBeDefined();
            expect(dummyConnector.data['team-new'].agents).toEqual({});
            expect(dummyConnector.data['team-new'].users).toBeDefined();
            expect(dummyConnector.data['team-new'].settings).toEqual({});
        });

        it('creates user entry under existing team', () => {
            DummyAccountHelper.addUserToTeam('user-1', 'team-b');

            expect(dummyConnector.data['team-b'].users['user-1']).toEqual({ settings: {} });
        });

        it('does not overwrite existing team data when adding user', () => {
            dummyConnector.data['team-pre'] = {
                users: {},
                agents: { 'agent-existing': { settings: { model: 'gpt-4' } } },
                settings: { plan: 'enterprise' },
            };

            DummyAccountHelper.addUserToTeam('user-new', 'team-pre');

            expect(dummyConnector.data['team-pre'].agents['agent-existing']).toEqual({ settings: { model: 'gpt-4' } });
            expect(dummyConnector.data['team-pre'].settings).toEqual({ plan: 'enterprise' });
            expect(dummyConnector.data['team-pre'].users['user-new']).toEqual({ settings: {} });
        });

        it('returns existing user data if user already exists', () => {
            dummyConnector.data['team-y'] = {
                users: { 'user-old': { settings: { role: 'viewer' } } },
                agents: {},
                settings: {},
            };

            const result = DummyAccountHelper.addUserToTeam('user-old', 'team-y');

            expect(result).toEqual({ settings: { role: 'viewer' } });
            expect(result).toBe(dummyConnector.data['team-y'].users['user-old']);
        });

        it('returns the newly created user data object', () => {
            const result = DummyAccountHelper.addUserToTeam('user-new', 'team-ret');

            expect(result).toEqual({ settings: {} });
            expect(result).toBe(dummyConnector.data['team-ret'].users['user-new']);
        });

        it('returns undefined if connector is not a DummyAccount', () => {
            mockGetAccountConnector.mockReturnValue({ data: {} });

            const result = DummyAccountHelper.addUserToTeam('user-1', 'team-1');

            expect(result).toBeUndefined();
        });

        it('can add multiple users to the same team', () => {
            DummyAccountHelper.addUserToTeam('user-1', 'team-multi');
            DummyAccountHelper.addUserToTeam('user-2', 'team-multi');
            DummyAccountHelper.addUserToTeam('user-3', 'team-multi');

            const users = dummyConnector.data['team-multi'].users;
            expect(Object.keys(users)).toHaveLength(3);
            expect(users['user-1']).toEqual({ settings: {} });
            expect(users['user-2']).toEqual({ settings: {} });
            expect(users['user-3']).toEqual({ settings: {} });
        });
    });

    // ── Mixed operations ──────────────────────────────────────────────

    describe('mixed agent and user operations', () => {
        it('agents and users coexist in the same team', () => {
            DummyAccountHelper.addAgentToTeam('agent-1', 'team-mix');
            DummyAccountHelper.addUserToTeam('user-1', 'team-mix');

            const team = dummyConnector.data['team-mix'];
            expect(team.agents['agent-1']).toEqual({ settings: {} });
            expect(team.users['user-1']).toEqual({ settings: {} });
        });

        it('team created by addAgentToTeam is reusable by addUserToTeam', () => {
            DummyAccountHelper.addAgentToTeam('agent-first', 'team-shared');
            DummyAccountHelper.addUserToTeam('user-second', 'team-shared');

            const team = dummyConnector.data['team-shared'];
            expect(Object.keys(team.agents)).toHaveLength(1);
            expect(Object.keys(team.users)).toHaveLength(1);
        });
    });
});
