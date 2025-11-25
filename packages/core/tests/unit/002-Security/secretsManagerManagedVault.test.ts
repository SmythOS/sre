import { describe, expect, it } from 'vitest';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { ConnectorService, ManagedVaultConnector, SecretManagerManagedVault, SmythRuntime } from 'index';


const SREInstance = SmythRuntime.Instance.init({
    ManagedVault: {
        Connector: 'SecretManagerManagedVault',
        Settings: {
            region: 'us-east-1',
            awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
            awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            prefix: 'smythos'
        },
    },
    Account: {
        Connector: 'DummyAccount',
    },
});

describe('Vault Tests', () => {
    it('Vault loaded', async () => {
        const vault: ManagedVaultConnector = ConnectorService.getManagedVaultConnector();
        expect(vault).toBeInstanceOf(SecretManagerManagedVault);
    });

    it('Create vault key', async () => {
        const vault: ManagedVaultConnector = ConnectorService.getManagedVaultConnector();
        await vault.user(AccessCandidate.team('team1')).set('openai', 'secret_value');
        expect(true).toBeTruthy();
    });

    it('Read vault key', async () => {
        const vault: ManagedVaultConnector = ConnectorService.getManagedVaultConnector();
        const value = await vault.user(AccessCandidate.team('team1')).get('openai');
        expect(value).toEqual('secret_value');
    });

    it('Do not allow reading key from different team', async () => {
        const vault: ManagedVaultConnector = ConnectorService.getManagedVaultConnector();

        //we use a team candidate here in order to test another team access
        const value = await vault
            .user(AccessCandidate.team('team2'))
            .get('openai')
            .catch((e) => null);
        expect(value).toBeUndefined();
    });

    it('Check vault key exists', async () => {
        const vault: ManagedVaultConnector = ConnectorService.getManagedVaultConnector();
        const exists = await vault.user(AccessCandidate.team('test')).exists('openai');
        expect(exists).toBeTruthy();
    });

    it('Delete vault key', async () => {
        const vault: ManagedVaultConnector = ConnectorService.getManagedVaultConnector();
        await vault.user(AccessCandidate.team('test')).delete('openai');

        expect(true).toBeTruthy();
    });

    it('Check vault key deleted and not exist', async () => {
        const vault: ManagedVaultConnector = ConnectorService.getManagedVaultConnector();
        const exists = await vault.user(AccessCandidate.team('test')).exists('openai');
        expect(exists).toBeFalsy();
    });
});
