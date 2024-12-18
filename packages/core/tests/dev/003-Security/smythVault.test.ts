import { describe, expect, it } from 'vitest';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { VaultConnector } from '@sre/Security/Vault.service/VaultConnector';
import { SmythVault } from '@sre/Security/Vault.service/connectors/SmythVault.class';
import { ConnectorService, SmythRuntime } from '@sre/index';
import {  TemplateString } from '@sre/helpers/TemplateString.helper';

const SREInstance = SmythRuntime.Instance.init({
    Vault: {
        Connector: 'SmythVault',
        Settings: {
          oAuthAppID: process.env.LOGTO_M2M_APP_ID,
          oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
          oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
          oAuthResource: process.env.LOGTO_API_RESOURCE,
          oAuthScope: '',
          vaultAPIBaseUrl: process.env.SMYTH_VAULT_API_BASE_URL,
        },
    },
    Account: {
        Connector: 'SmythAccount',
    }
});

describe('Vault Tests', () => {
    it('Vault loaded', async () => {
        const vault: VaultConnector = ConnectorService.getVaultConnector('SmythVault');
        expect(vault).toBeInstanceOf(SmythVault);
    });

    it('Read vault key', async () => {
        const vault: VaultConnector = ConnectorService.getVaultConnector();

        const value = await vault.user(AccessCandidate.team('test')).get('test');
        expect(value).toEqual('test_value');
    });

    it('Read vault key by name', async () => {
        const vault: VaultConnector = ConnectorService.getVaultConnector();

        const value = await vault.user(AccessCandidate.team('test')).get('test_key');
        expect(value).toEqual('test_value');
    });

    it('Do not allow reading key from different team', async () => {
        const vault: VaultConnector = ConnectorService.getVaultConnector();

        //we use a team candidate here in order to test another team access
        const value = await vault
            .user(AccessCandidate.team('Team2'))
            .get('test')
            .catch((e) => null);

        expect(value).toBeNull();
    });

    it('Parse a template string containing vault keys', async () => {
        const tpl = `using a vault key : {{secret}} and a simple template variable : {{MyVAR}}`;
        const teamId = 'test';
        const vault: VaultConnector = ConnectorService.getVaultConnector();
        const value = await vault.user(AccessCandidate.team(teamId)).get('test');
        //prettier-ignore
        const result = await TemplateString(tpl)
            .parse({ MyVAR: 'Hello', secret: value }).result
        expect(result).toEqual('using a vault key : test_value and a simple template variable : Hello');
    });


});
