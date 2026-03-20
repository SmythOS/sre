import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockVaultRequester = {
    get: vi.fn(),
    listKeys: vi.fn(),
};

vi.mock('@smythos/sre', async () => {
    return {
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id }),
            user: (id: string) => ({ type: 'user', id }),
        },
        ConnectorService: {
            getVaultConnector() {
                return {
                    requester(candidate: any) {
                        return mockVaultRequester;
                    },
                };
            },
        },
        SRE: {
            init: vi.fn(),
            ready: vi.fn().mockResolvedValue(true),
            initializing: false,
        },
    };
});

import { VaultInstance } from '../../../src/Vault/VaultInstance.class';

describe('VaultInstance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('uses default team candidate when none provided', async () => {
            const vault = new VaultInstance();
            await vault.ready;
            // Vault was created successfully with default candidate
            expect(vault).toBeInstanceOf(VaultInstance);
        });

        it('accepts a custom candidate', async () => {
            const { AccessCandidate } = await import('@smythos/sre');
            const candidate = AccessCandidate.user('custom-user');
            const vault = new VaultInstance(candidate as any);
            await vault.ready;
            expect(vault).toBeInstanceOf(VaultInstance);
        });
    });

    describe('ready promise', () => {
        it('resolves after init completes', async () => {
            const vault = new VaultInstance();
            const result = await vault.ready;
            expect(result).toBe(true);
        });

        it('calls SRE.init when SRE is not initializing', async () => {
            const { SRE } = await import('@smythos/sre');
            const vault = new VaultInstance();
            await vault.ready;
            expect(SRE.init).toHaveBeenCalledWith({});
        });

        it('calls SRE.ready to wait for initialization', async () => {
            const { SRE } = await import('@smythos/sre');
            const vault = new VaultInstance();
            await vault.ready;
            expect(SRE.ready).toHaveBeenCalled();
        });
    });

    describe('get()', () => {
        it('returns the value from the vault requester', async () => {
            mockVaultRequester.get.mockResolvedValue('secret-value');
            const vault = new VaultInstance();
            await vault.ready;

            const value = await vault.get('my-key');

            expect(value).toBe('secret-value');
            expect(mockVaultRequester.get).toHaveBeenCalledWith('my-key');
        });

        it('returns undefined when key does not exist', async () => {
            mockVaultRequester.get.mockResolvedValue(undefined);
            const vault = new VaultInstance();
            await vault.ready;

            const value = await vault.get('nonexistent');

            expect(value).toBeUndefined();
            expect(mockVaultRequester.get).toHaveBeenCalledWith('nonexistent');
        });

        it('propagates errors from the vault requester', async () => {
            mockVaultRequester.get.mockRejectedValue(new Error('vault error'));
            const vault = new VaultInstance();
            await vault.ready;

            await expect(vault.get('bad-key')).rejects.toThrow('vault error');
        });
    });

    describe('listKeys()', () => {
        it('returns an array of keys from the vault requester', async () => {
            const keys = ['key-1', 'key-2', 'key-3'];
            mockVaultRequester.listKeys.mockResolvedValue(keys);
            const vault = new VaultInstance();
            await vault.ready;

            const result = await vault.listKeys();

            expect(result).toEqual(keys);
            expect(mockVaultRequester.listKeys).toHaveBeenCalled();
        });

        it('returns an empty array when no keys exist', async () => {
            mockVaultRequester.listKeys.mockResolvedValue([]);
            const vault = new VaultInstance();
            await vault.ready;

            const result = await vault.listKeys();

            expect(result).toEqual([]);
        });

        it('propagates errors from the vault requester', async () => {
            mockVaultRequester.listKeys.mockRejectedValue(new Error('list error'));
            const vault = new VaultInstance();
            await vault.ready;

            await expect(vault.listKeys()).rejects.toThrow('list error');
        });
    });
});
