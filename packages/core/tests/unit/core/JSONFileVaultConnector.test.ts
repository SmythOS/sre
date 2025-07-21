import { describe, expect, it } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { IAccessCandidate, TAccessRole } from 'index';

setupSRE({
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: '/Users/zubair/Zubair/SmythOS/smyth-opensource/smythos-ui/vault.json',
        },
    },
    Log: {
        Connector: 'ConsoleLog',
    },
});

describe('JSONFileVault Tests', () => {
    it(
        'List all keys in the vault',
        async () => {
            const mockCandidate: IAccessCandidate = {
                id: 'default',
                role: TAccessRole.Team,
            };

            const vaultConnector = ConnectorService.getVaultConnector('JSONFileVault');
            const result = await vaultConnector.team(mockCandidate.id).listKeys();
            expect(result).toBeDefined();
        },
    );

    it(
        'Get a key from the vault',
        async () => {
            const mockCandidate: IAccessCandidate = {
                id: 'default',
                role: TAccessRole.Team,
            };

            const vaultConnector = ConnectorService.getVaultConnector('JSONFileVault');
            const result = await vaultConnector.team(mockCandidate.id).get('testKey');
            expect(result).toBe('testValue');
        },
    );
});