import { describe, expect, it } from 'vitest';

//import SRE, { AgentRequest } from '../../dist';

import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

import { VaultConnector } from '@sre/Security/Vault.service/VaultConnector';
import { JSONFileVault } from '@sre/Security/Vault.service/connectors/JSONFileVault.class';
import { SmythRuntime } from '@sre/index';

const SREInstance = SmythRuntime.Instance.init({
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './tests/data/vault.json',
        },
    },
});

describe('Vault Tests', () => {
    it('Vault loaded', async () => {
        const vault: VaultConnector = SREInstance.Vault;
        expect(vault).toBeInstanceOf(JSONFileVault);
    });

    it('Read vault key', async () => {
        const vault: VaultConnector = SREInstance.Vault;

        //by default current team resolver resolves every user team to "default"
        const value = await vault.user(AccessCandidate.user('test')).get('DIFFBOT_API');

        expect(value).toEqual('THIS_IS_A_FAKE_DIFFBOT_API_KEY');
    });

    it('Do not allow reading key from different team', async () => {
        const vault: VaultConnector = SREInstance.Vault;

        //we use a team candidate here in order to test another team access
        const value = await vault
            .user(AccessCandidate.team('Team2'))
            .get('DIFFBOT_API')
            .catch((e) => undefined);

        expect(value).toBeUndefined();
    });
});
