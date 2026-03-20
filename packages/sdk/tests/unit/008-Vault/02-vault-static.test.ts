import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockVaultRequester = {
    get: vi.fn(),
    listKeys: vi.fn(),
};

const mockRequester = vi.fn().mockReturnValue(mockVaultRequester);

vi.mock('@smythos/sre', async () => {
    return {
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id }),
            user: (id: string) => ({ type: 'user', id }),
        },
        ConnectorService: {
            getVaultConnector() {
                return {
                    requester: mockRequester,
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

import { Vault } from '../../../src/Vault/Vault';
import { AccessCandidate } from '@smythos/sre';

describe('Vault (static class)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequester.mockReturnValue(mockVaultRequester);
    });

    describe('get()', () => {
        it('retrieves a value with default team candidate when none provided', async () => {
            mockVaultRequester.get.mockResolvedValue('default-secret');

            const value = await Vault.get('api-key');

            expect(value).toBe('default-secret');
            expect(mockRequester).toHaveBeenCalledWith({ type: 'team', id: 'default' });
            expect(mockVaultRequester.get).toHaveBeenCalledWith('api-key');
        });

        it('retrieves a value with a custom candidate', async () => {
            mockVaultRequester.get.mockResolvedValue('user-secret');
            const candidate = AccessCandidate.user('user-123');

            const value = await Vault.get('user-key', candidate as any);

            expect(value).toBe('user-secret');
            expect(mockRequester).toHaveBeenCalledWith({ type: 'user', id: 'user-123' });
            expect(mockVaultRequester.get).toHaveBeenCalledWith('user-key');
        });

        it('returns undefined when key does not exist', async () => {
            mockVaultRequester.get.mockResolvedValue(undefined);

            const value = await Vault.get('missing');

            expect(value).toBeUndefined();
        });

        it('propagates errors from the vault requester', async () => {
            mockVaultRequester.get.mockRejectedValue(new Error('access denied'));

            await expect(Vault.get('forbidden-key')).rejects.toThrow('access denied');
        });
    });

    describe('listKeys()', () => {
        it('lists keys with default team candidate when none provided', async () => {
            const keys = ['key-a', 'key-b'];
            mockVaultRequester.listKeys.mockResolvedValue(keys);

            const result = await Vault.listKeys();

            expect(result).toEqual(keys);
            expect(mockRequester).toHaveBeenCalledWith({ type: 'team', id: 'default' });
            expect(mockVaultRequester.listKeys).toHaveBeenCalled();
        });

        it('lists keys with a custom candidate', async () => {
            const keys = ['user-key-1'];
            mockVaultRequester.listKeys.mockResolvedValue(keys);
            const candidate = AccessCandidate.user('user-456');

            const result = await Vault.listKeys(candidate as any);

            expect(result).toEqual(keys);
            expect(mockRequester).toHaveBeenCalledWith({ type: 'user', id: 'user-456' });
        });

        it('returns an empty array when no keys exist', async () => {
            mockVaultRequester.listKeys.mockResolvedValue([]);

            const result = await Vault.listKeys();

            expect(result).toEqual([]);
        });

        it('propagates errors from the vault requester', async () => {
            mockVaultRequester.listKeys.mockRejectedValue(new Error('list denied'));

            await expect(Vault.listKeys()).rejects.toThrow('list denied');
        });
    });
});
