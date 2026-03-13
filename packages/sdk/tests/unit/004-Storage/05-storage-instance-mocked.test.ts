// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock state (hoisted for vi.mock factory)
// ---------------------------------------------------------------------------
const { mockFsRead, mockFsWrite, mockFsDelete, mockFsExists, mockGetCandidateTeam } = vi.hoisted(() => ({
    mockFsRead: vi.fn(),
    mockFsWrite: vi.fn(),
    mockFsDelete: vi.fn(),
    mockFsExists: vi.fn(),
    mockGetCandidateTeam: vi.fn().mockResolvedValue('team-123'),
}));

let mockConnectorValid = true;
let mockInitValid = true;

vi.mock('@smythos/sre', async () => {
    return {
        DEFAULT_TEAM_ID: 'default',
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id, role: 'team' }),
            agent: (id: string) => ({ type: 'agent', id, role: 'agent' }),
            user: (id: string) => ({ type: 'user', id, role: 'user' }),
        },
        TAccessRole: { Agent: 'agent', User: 'user', Team: 'team' },
        ConnectorService: {
            getStorageConnector(providerId?: string) {
                if (!mockConnectorValid) return null;
                return {
                    valid: true,
                    instance: () => 'mock-storage-connector',
                    settings: {},
                };
            },
            init(type: string, providerId: string, name: string, settings: any) {
                if (!mockInitValid) return { valid: false };
                return {
                    valid: true,
                    instance: () => 'mock-storage-connector',
                    settings: {},
                };
            },
            getAccountConnector() {
                return { getCandidateTeam: mockGetCandidateTeam };
            },
            getModelsProviderConnector() { return null; },
            getLLMConnector() { return null; },
        },
        TConnectorService: { Storage: 'Storage' },
        TStorageProvider: { default: 'default', LocalStorage: 'LocalStorage' },
        SmythFS: {
            Instance: {
                read: mockFsRead,
                write: mockFsWrite,
                delete: mockFsDelete,
                exists: mockFsExists,
            },
            getInstance: vi.fn().mockReturnValue({
                read: mockFsRead,
                write: mockFsWrite,
                delete: mockFsDelete,
                exists: mockFsExists,
            }),
        },
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
    };
});

import { StorageInstance } from '../../../src/Storage/StorageInstance.class';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('StorageInstance (mocked)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockConnectorValid = true;
        mockInitValid = true;
    });

    // ── Constructor ──────────────────────────────────────────────────

    describe('constructor', () => {
        it('creates instance with default provider using SmythFS.Instance', () => {
            const storage = new StorageInstance('default' as any);
            expect(storage).toBeInstanceOf(StorageInstance);
            expect(storage.fs).toBeDefined();
        });

        it('creates instance with named provider', () => {
            const storage = new StorageInstance('LocalStorage' as any);
            expect(storage).toBeInstanceOf(StorageInstance);
        });

        it('falls back to ConnectorService.init when connector is invalid', () => {
            mockConnectorValid = false;
            mockInitValid = true;
            const storage = new StorageInstance('LocalStorage' as any);
            expect(storage).toBeInstanceOf(StorageInstance);
        });

        it('throws when connector is not available from both sources', () => {
            mockConnectorValid = false;
            mockInitValid = false;
            expect(() => new StorageInstance('BadProvider' as any)).toThrow(
                'Storage connector BadProvider is not available',
            );
        });

        it('uses team candidate by default', () => {
            const storage = new StorageInstance('default' as any);
            expect(storage).toBeDefined();
        });

        it('accepts custom candidate', () => {
            const candidate = { type: 'agent', id: 'agent-1', role: 'agent' } as any;
            const storage = new StorageInstance('default' as any, {}, candidate);
            expect(storage).toBeDefined();
        });
    });

    // ── read() ───────────────────────────────────────────────────────

    describe('read()', () => {
        it('reads from URI when resource name starts with smythfs://', async () => {
            mockFsRead.mockResolvedValue(Buffer.from('data'));
            const storage = new StorageInstance('default' as any);
            const result = await storage.read('smythfs://agent.team/file.txt');
            expect(mockFsRead).toHaveBeenCalledWith('smythfs://agent.team/file.txt', expect.anything());
            expect(Buffer.isBuffer(result)).toBe(true);
        });

        it('constructs URI from resource name', async () => {
            mockFsRead.mockResolvedValue(Buffer.from('data'));
            const candidate = { type: 'team', id: 'team-1', role: 'team' } as any;
            const storage = new StorageInstance('default' as any, {}, candidate);
            await storage.read('file.txt');
            expect(mockGetCandidateTeam).toHaveBeenCalled();
            expect(mockFsRead).toHaveBeenCalledWith(
                expect.stringContaining('smythfs://'),
                expect.anything(),
            );
        });

        it('throws and logs error when fs.read fails', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockFsRead.mockRejectedValue(new Error('read error'));
            const storage = new StorageInstance('default' as any);
            await expect(storage.read('smythfs://a.team/file')).rejects.toThrow('read error');
            errorSpy.mockRestore();
        });
    });

    // ── write() ──────────────────────────────────────────────────────

    describe('write()', () => {
        it('writes and returns URI when using smythfs:// path', async () => {
            mockFsWrite.mockResolvedValue(undefined);
            const storage = new StorageInstance('default' as any);
            const uri = await storage.write('smythfs://a.team/file.txt', 'hello');
            expect(uri).toBe('smythfs://a.team/file.txt');
            expect(mockFsWrite).toHaveBeenCalledWith('smythfs://a.team/file.txt', 'hello', expect.anything());
        });

        it('constructs URI from resource name', async () => {
            mockFsWrite.mockResolvedValue(undefined);
            const candidate = { type: 'agent', id: 'agent-1', role: 'agent' } as any;
            const storage = new StorageInstance('default' as any, {}, candidate);
            const uri = await storage.write('file.txt', 'content');
            expect(uri).toContain('smythfs://');
            expect(uri).toContain('agent-1');
        });

        it('throws and logs error when fs.write fails', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockFsWrite.mockRejectedValue(new Error('write error'));
            const storage = new StorageInstance('default' as any);
            await expect(storage.write('smythfs://a.team/f', 'data')).rejects.toThrow('write error');
            errorSpy.mockRestore();
        });
    });

    // ── delete() ─────────────────────────────────────────────────────

    describe('delete()', () => {
        it('deletes and returns URI', async () => {
            mockFsDelete.mockResolvedValue(undefined);
            const storage = new StorageInstance('default' as any);
            const uri = await storage.delete('smythfs://a.team/file.txt');
            expect(uri).toBe('smythfs://a.team/file.txt');
        });

        it('constructs URI when not a smythfs path', async () => {
            mockFsDelete.mockResolvedValue(undefined);
            const candidate = { type: 'agent', id: 'agent-1', role: 'agent' } as any;
            const storage = new StorageInstance('default' as any, {}, candidate);
            const uri = await storage.delete('file.txt');
            expect(uri).toContain('smythfs://');
        });

        it('throws and logs error when fs.delete fails', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockFsDelete.mockRejectedValue(new Error('delete error'));
            const storage = new StorageInstance('default' as any);
            await expect(storage.delete('smythfs://a.team/f')).rejects.toThrow('delete error');
            errorSpy.mockRestore();
        });
    });

    // ── exists() ─────────────────────────────────────────────────────

    describe('exists()', () => {
        it('returns URI when resource exists', async () => {
            mockFsExists.mockResolvedValue(true);
            const storage = new StorageInstance('default' as any);
            const result = await storage.exists('smythfs://a.team/file.txt');
            expect(result).toBe('smythfs://a.team/file.txt');
        });

        it('throws when fs.exists fails', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockFsExists.mockRejectedValue(new Error('exists error'));
            const storage = new StorageInstance('default' as any);
            await expect(storage.exists('smythfs://a.team/f')).rejects.toThrow('exists error');
            errorSpy.mockRestore();
        });

        it('constructs URI from resource name (non-smythfs)', async () => {
            mockFsExists.mockResolvedValue(true);
            const candidate = { type: 'agent', id: 'agent-1', role: 'agent' } as any;
            const storage = new StorageInstance('default' as any, {}, candidate);
            const result = await storage.exists('myfile.txt');
            expect(result).toContain('smythfs://');
        });
    });

    // ── URI construction ─────────────────────────────────────────────

    describe('URI construction by role', () => {
        it('constructs .agent TLD for agent candidate', async () => {
            mockFsRead.mockResolvedValue(Buffer.from('data'));
            const candidate = { type: 'agent', id: 'agent-1', role: 'agent' } as any;
            const storage = new StorageInstance('default' as any, {}, candidate);
            await storage.read('myfile.txt');
            const uri = mockFsRead.mock.calls[0][0];
            expect(uri).toContain('.agent/');
        });

        it('constructs .user TLD for user candidate', async () => {
            mockFsRead.mockResolvedValue(Buffer.from('data'));
            const candidate = { type: 'user', id: 'user-1', role: 'user' } as any;
            const storage = new StorageInstance('default' as any, {}, candidate);
            await storage.read('myfile.txt');
            const uri = mockFsRead.mock.calls[0][0];
            expect(uri).toContain('.user/');
        });

        it('constructs .team TLD for team candidate', async () => {
            mockFsRead.mockResolvedValue(Buffer.from('data'));
            const candidate = { type: 'team', id: 'team-1', role: 'team' } as any;
            const storage = new StorageInstance('default' as any, {}, candidate);
            await storage.read('myfile.txt');
            const uri = mockFsRead.mock.calls[0][0];
            expect(uri).toContain('.team/');
        });

        it('caches team ID after first resolution', async () => {
            mockFsRead.mockResolvedValue(Buffer.from('data'));
            const candidate = { type: 'agent', id: 'agent-1', role: 'agent' } as any;
            const storage = new StorageInstance('default' as any, {}, candidate);
            await storage.read('file1.txt');
            await storage.read('file2.txt');
            // getCandidateTeam should only be called once (cached)
            expect(mockGetCandidateTeam).toHaveBeenCalledTimes(1);
        });
    });

    // ── fs getter ────────────────────────────────────────────────────

    describe('fs getter', () => {
        it('returns SmythFS instance for default provider', () => {
            const storage = new StorageInstance('default' as any);
            expect(storage.fs).toBeDefined();
        });
    });
});
