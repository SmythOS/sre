import { describe, expect, it } from 'vitest';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { VaultConnector } from '@sre/Security/Vault.service/VaultConnector';
import { SecretsManager } from '@sre/Security/Vault.service/connectors/SecretsManager.class';

import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { ConnectorService, SmythRuntime } from 'index';

const SREInstance = SmythRuntime.Instance.init({
    Vault: {
        Connector: 'SecretsManager',
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
        const vault: VaultConnector = ConnectorService.getVaultConnector('SecretsManager');
        expect(vault).toBeInstanceOf(SecretsManager);
    });

    it('Read secret', async () => {
        const vault: VaultConnector = ConnectorService.getVaultConnector();
        const value = await vault.user(AccessCandidate.team('test')).get('secret');
        expect(value).toEqual('test_value');
    });

    it('Do not allow random secrets to be read', async () => {
        const vault: VaultConnector = ConnectorService.getVaultConnector();

        const value = await vault
            .user(AccessCandidate.team('randomSecretId'))
            .get('test')
            .catch((e) => undefined);
        expect(value).toBeUndefined();
    });

    it('Parse a template string containing secret', async () => {
        const tpl = `using a vault key : {{secret}} and a simple template variable : {{MyVAR}}`;
        const teamId = 'test';
        const vault: VaultConnector = ConnectorService.getVaultConnector();
        const value = await vault.user(AccessCandidate.team(teamId)).get('secret');
        const result = await TemplateString(tpl).parse({ MyVAR: 'Hello', secret: value }).result;
        expect(result).toEqual('using a vault key : test_value and a simple template variable : Hello');
    });
});
