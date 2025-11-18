import { describe, expect, it } from 'vitest';

import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

import { VaultConnector } from '@sre/Security/Vault.service/VaultConnector';
import { ConnectorService, SecretsManager, SmythRuntime } from 'index';


const SREInstance = SmythRuntime.Instance.init({
    Vault: {
        Connector: 'SecretsManager',
        Settings: {
            region: 'us-east-1',
            awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
            awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    },
    Account: {
        Connector: 'DummyAccount',
    },
});

describe('Vault Tests', () => {
    it('Vault loaded', async () => {
        const vault: VaultConnector = ConnectorService.getVaultConnector();
        expect(vault).toBeInstanceOf(SecretsManager);
    });

    it('Read vault key', async () => {
        const vault: VaultConnector = ConnectorService.getVaultConnector();
        const value = await vault.user(AccessCandidate.team('team1')).get('openai');
        expect(value).toBeDefined();
    });

    it('Do not allow reading key from different team', async () => {
        const vault: VaultConnector = ConnectorService.getVaultConnector();

        //we use a team candidate here in order to test another team access
        const value = await vault
            .user(AccessCandidate.team('team2'))
            .get('openai')
            .catch((e) => null);
        expect(value).toBeUndefined();
    });
    it('List keys', async () => {
        const vault: VaultConnector = ConnectorService.getVaultConnector();
        const value = await vault
            .user(AccessCandidate.team('team1'))
            .listKeys()
            .catch((e) => undefined);
        expect(value).toBeDefined();
    });

});
