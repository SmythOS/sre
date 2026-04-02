// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@smythos/sre', async () => {
    return {
        DEFAULT_TEAM_ID: 'default',
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id, role: 'team' }),
            agent: (id: string) => ({ type: 'agent', id, role: 'agent' }),
        },
        ConnectorService: {
            getStorageConnector() {
                return {
                    valid: true,
                    instance: () => 'mock-connector',
                    settings: {},
                };
            },
            init() { return { valid: true, instance: () => 'mock-connector', settings: {} }; },
            getModelsProviderConnector() { return null; },
            getLLMConnector() { return null; },
            getAccountConnector() { return { getCandidateTeam: vi.fn().mockResolvedValue('team-1') }; },
        },
        TConnectorService: { Storage: 'Storage' },
        TStorageProvider: { default: 'default', LocalStorage: 'LocalStorage', S3: 'S3' },
        Scope: { TEAM: 'team', AGENT: 'agent' },
        SmythFS: {
            Instance: { read: vi.fn(), write: vi.fn(), delete: vi.fn(), exists: vi.fn() },
            getInstance: vi.fn().mockReturnValue({ read: vi.fn(), write: vi.fn(), delete: vi.fn(), exists: vi.fn() }),
        },
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
        TAccessRole: { Agent: 'agent', User: 'user', Team: 'team' },
    };
});

import { Storage } from '../../../src/Storage/Storage.class';

// ---------------------------------------------------------------------------
// Storage factory
// ---------------------------------------------------------------------------
describe('Storage factory', () => {
    it('has factory methods for each provider', () => {
        expect(typeof Storage.default).toBe('function');
        expect(typeof Storage.LocalStorage).toBe('function');
    });

    it('creates StorageInstance from default()', () => {
        const instance = Storage.default();
        expect(instance).toBeDefined();
        expect(typeof instance.read).toBe('function');
    });

    it('creates StorageInstance from LocalStorage()', () => {
        const instance = Storage.LocalStorage();
        expect(instance).toBeDefined();
    });

    it('passes settings through', () => {
        const instance = Storage.LocalStorage({ customSetting: true });
        expect(instance).toBeDefined();
    });

    it('warns for string scope (invalid type)', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        Storage.LocalStorage({}, 'bad-scope' as any);
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('extracts scope from settings object', () => {
        const instance = Storage.LocalStorage({ scope: 'team' });
        expect(instance).toBeDefined();
    });

    it('warns with agent-specific message for Scope.AGENT string', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        Storage.LocalStorage({}, 'agent' as any);
        const msg = warnSpy.mock.calls[0]?.[0] || '';
        expect(msg).toContain('AccessCandidate.agent');
        warnSpy.mockRestore();
    });

    it('warns with team-specific message for Scope.TEAM string', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        Storage.LocalStorage({}, 'team' as any);
        const msg = warnSpy.mock.calls[0]?.[0] || '';
        expect(msg).toContain('AccessCandidate.team');
        warnSpy.mockRestore();
    });

    it('accepts AccessCandidate directly as scope', () => {
        const candidate = { type: 'agent', id: 'a1', role: 'agent' } as any;
        const instance = Storage.LocalStorage({}, candidate);
        expect(instance).toBeDefined();
    });
});
