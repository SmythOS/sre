import { describe, expect, it } from 'vitest';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { IAccessCandidate, TAccessRole } from 'index';
import { testData } from '../../utils/test-data-manager';

setupSRE({
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: testData.getDataPath('vault.fake.json'),
        },
    },
    Log: {
        Connector: 'ConsoleLog',
    },
});

describe('JSONFileVault Tests', () => {
    it('List all keys in the vault', async () => {
        const mockCandidate: IAccessCandidate = {
            id: 'default',
            role: TAccessRole.Team,
        };

        const vaultConnector = ConnectorService.getVaultConnector('JSONFileVault');
        const result = await vaultConnector.team(mockCandidate.id).listKeys();
        expect(result).toBeDefined();
    });

    it('Get a key from the vault', async () => {
        const mockCandidate: IAccessCandidate = {
            id: 'default',
            role: TAccessRole.Team,
        };

        const vaultConnector = ConnectorService.getVaultConnector('JSONFileVault');
        const result = await vaultConnector.team(mockCandidate.id).get('my-key');
        expect(result).toBe('Hello world');
    });
});
