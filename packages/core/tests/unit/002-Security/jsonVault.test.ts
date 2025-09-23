import { describe, expect, it } from 'vitest';

//import SRE, { AgentRequest } from '../../dist';

import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

import { VaultConnector } from '@sre/Security/Vault.service/VaultConnector';
import { JSONFileVault } from '@sre/Security/Vault.service/connectors/JSONFileVault.class';
import { ConnectorService, SmythRuntime } from 'index';
import { Match, TemplateString, TPLProcessor } from '@sre/helpers/TemplateString.helper';
import { VaultHelper } from '@sre/Security/Vault.service/Vault.helper';
import { testData } from '../../utils/test-data-manager';

const SREInstance = SmythRuntime.Instance.init({
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: testData.getDataPath('vault.fake.json'),
        },
    },
    Account: {
        Connector: 'DummyAccount',
    },
});

describe('Vault Tests', () => {
    it('Vault loaded', async () => {
        const vault: VaultConnector = ConnectorService.getVaultConnector();
        expect(vault).toBeInstanceOf(JSONFileVault);
    });

    it('Read vault key', async () => {
        const vault: VaultConnector = ConnectorService.getVaultConnector();

        //by default current team resolver resolves every user team to "default"
        const value = await vault.user(AccessCandidate.user('test')).get('DIFFBOT_API');

        expect(value).toEqual('THIS_IS_A_FAKE_DIFFBOT_API_KEY');
    });

    it('Do not allow reading key from different team', async () => {
        const vault: VaultConnector = ConnectorService.getVaultConnector();

        //we use a team candidate here in order to test another team access
        const value = await vault
            .user(AccessCandidate.team('Team2'))
            .get('DIFFBOT_API')
            .catch((e) => undefined);

        expect(value).toBeUndefined();
    });

    it('Parse a template string containing vault keys', async () => {
        const tpl = `using a vault key : {{KEY(DIFFBOT_API)}} and a simple template variable : {{MyVAR}}`;
        const teamId = 'default';

        //prettier-ignore
        const result = await TemplateString(tpl)
            .parse({ MyVAR: 'Hello' })            
            .parseTeamKeysAsync(teamId)
            .asyncResult; //since parseTeamKeys is async, we use asyncResult with await to wait for the result

        expect(result).toEqual('using a vault key : THIS_IS_A_FAKE_DIFFBOT_API_KEY and a simple template variable : Hello');
    });
});
