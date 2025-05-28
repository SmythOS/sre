import { describe, expect, it } from 'vitest';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { ConnectorService, SmythRuntime } from '@sre/index';
import { SmythAccount } from '@sre/Security/Account.service/connectors/SmythAccount.class';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';

const SREInstance = SmythRuntime.Instance.init({
    Account: {
        Connector: 'SmythAccount',
        Settings: {
            oAuthAppID: process.env.LOGTO_M2M_APP_ID,
            oAuthAppSecret: process.env.LOGTO_M2M_APP_SECRET,
            oAuthBaseUrl: `${process.env.LOGTO_SERVER}/oidc/token`,
            oAuthResource: process.env.LOGTO_API_RESOURCE,
            oAuthScope: '',
            smythAPIBaseUrl: process.env.SMYTH_API_BASE_URL,
        },
    },
});

describe('Smyth Account Tests', () => {
    it('Smyth Account loaded', async () => {
        const smythAccount: AccountConnector = ConnectorService.getAccountConnector('SmythAccount');
        expect(smythAccount).toBeInstanceOf(SmythAccount);
    });

    it('Verify user to be team member', async () => {
        const smythAccount: AccountConnector = ConnectorService.getAccountConnector('SmythAccount');
        const value = await smythAccount.user(AccessCandidate.user('876')).isTeamMember('clyx0dgia0bfuccoqvwle2zsr');
        expect(value).toEqual(true);
    });

    it('Verify user not to be team member', async () => {
        const smythAccount: AccountConnector = ConnectorService.getAccountConnector('SmythAccount');
        const value = await smythAccount.user(AccessCandidate.user('975')).isTeamMember('clyx0dgia0bfuccoqvwle2zsr');
        expect(value).toEqual(false);
    });

    it('Verify correct team is returning for user', async () => {
        const smythAccount: AccountConnector = ConnectorService.getAccountConnector('SmythAccount');
        const team = await smythAccount.user('876').getCandidateTeam();
        expect(team).toEqual('clyx0dgia0bfuccoqvwle2zsr');
    });

    it('Verify correct team is returning for team', async () => {
        const smythAccount: AccountConnector = ConnectorService.getAccountConnector('SmythAccount');
        const team = await smythAccount.team('clyx0dgia0bfuccoqvwle2zsr').getCandidateTeam();
        expect(team).toEqual('clyx0dgia0bfuccoqvwle2zsr');
    });

    it('Verify correct team is returning for agent', async () => {
        const smythAccount: AccountConnector = ConnectorService.getAccountConnector('SmythAccount');
        const team = await smythAccount.user(AccessCandidate.agent('clzmufcbd09zqne7l6poq5168')).getCandidateTeam();
        expect(team).toEqual('clyx0dgia0bfuccoqvwle2zsr');
    });

    it('Verify all account settings are returning', async () => {
        const smythAccount: AccountConnector = ConnectorService.getAccountConnector('SmythAccount');
        const userSettings = await smythAccount.user(AccessCandidate.user('876')).getAllUserSettings();
        const userMetadataSettings = userSettings['UserMarketingMetadata'];
        expect(JSON.parse(userMetadataSettings || '{}')?.name).toEqual('Zubair');
    });

    it('Verify all team settings are returning', async () => {
        const smythAccount: AccountConnector = ConnectorService.getAccountConnector('SmythAccount');
        const teamSettings = await smythAccount.user(AccessCandidate.team('clyx0dgia0bfuccoqvwle2zsr')).getAllTeamSettings();
        const vaultSettings = teamSettings['vault'];
        expect(vaultSettings).toBeTypeOf('string');
    });

    it('Verify specific account setting is returning', async () => {
        const smythAccount: AccountConnector = ConnectorService.getAccountConnector('SmythAccount');
        const userSettings = await smythAccount.user(AccessCandidate.user('876')).getUserSetting('UserMarketingMetadata');
        expect(JSON.parse(userSettings || '{}')?.name).toEqual('Zubair');
    });

    it('Verify specific team setting is returning', async () => {
        const smythAccount: AccountConnector = ConnectorService.getAccountConnector('SmythAccount');
        const teamSettings = await smythAccount.user(AccessCandidate.team('clyx0dgia0bfuccoqvwle2zsr')).getTeamSetting('vault');
        expect(teamSettings).toBeTypeOf('string');
    });

    it('Verify agent can access account setting', async () => {
        const smythAccount: AccountConnector = ConnectorService.getAccountConnector('SmythAccount');
        const team = await smythAccount.user(AccessCandidate.agent('clzmufcbd09zqne7l6poq5168')).getCandidateTeam();
        const teamSettings = await smythAccount.user(AccessCandidate.team(team)).getTeamSetting('vault');
        expect(teamSettings).toBeTypeOf('string');
    });

    it('Invalid setting key to be returned as null', async () => {
        const smythAccount: AccountConnector = ConnectorService.getAccountConnector('SmythAccount');
        const teamSettings = await smythAccount.user(AccessCandidate.team('clyx0dgia0bfuccoqvwle2zsr')).getTeamSetting('test');
        expect(teamSettings).toBeNull();
    });
});
