import { describe, expect, it } from 'vitest';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { SecretManagerManagedVault } from '@sre/Security/ManagedVault.service/connectors/SecretManagerManagedVault';
import { ConnectorService, SmythRuntime } from 'index';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { ManagedVaultConnector } from '@sre/Security/ManagedVault.service/ManagedVaultConnector';

const SREInstance = SmythRuntime.Instance.init({
    ManagedVault: {
        Connector: 'SecretManagerManagedVault',
        Settings: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION,
        },
    },
    Account: {
        Connector: 'SmythAccount',
    },
});

describe('Secret Manager Tests', () => {
    it('Secret Manager loaded', async () => {
        const vault: ManagedVaultConnector = ConnectorService.getManagedVaultConnector('SecretManagerManagedVault');
        expect(vault).toBeInstanceOf(SecretManagerManagedVault);
    });

    it('Read secret', async () => {
        const vault: ManagedVaultConnector = ConnectorService.getManagedVaultConnector('SecretManagerManagedVault');
        const value = await vault.user(AccessCandidate.team('test')).get('secret_key');
        expect(value).toEqual('secret_value');
    });

    // it('Create secret', async () => {
    //     const vault: ManagedVaultConnector = ConnectorService.getManagedVaultConnector('SecretManagerManagedVault');
    //     await vault.user(AccessCandidate.team('test')).set('secret_key_1', 'secret_value_1');
    //     expect(true).toBeTruthy();
    // });

    it('Do not allow random secrets to be read', async () => {
        const vault: ManagedVaultConnector = ConnectorService.getManagedVaultConnector('SecretManagerManagedVault');

        const value = await vault
            .user(AccessCandidate.team('randomSecretId'))
            .get('test')
            .catch((e) => undefined);
        expect(value).toBeUndefined();
    });

    it('Parse a template string containing secret', async () => {
        const tpl = `using a vault key : {{secret}} and a simple template variable : {{MyVAR}}`;
        const teamId = 'test';
        const vault: ManagedVaultConnector = ConnectorService.getManagedVaultConnector('SecretManagerManagedVault');
        const value = await vault.user(AccessCandidate.team(teamId)).get('secret_key');
        const result = await TemplateString(tpl).parse({ MyVAR: 'Hello', secret: value }).result;
        expect(result).toEqual('using a vault key : secret_value and a simple template variable : Hello');
    });
});
