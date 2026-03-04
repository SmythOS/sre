import { describe, expect, it } from 'vitest';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { ConnectorService, JSONFileAccount, SmythRuntime } from 'index';

import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { testData } from '../../utils/test-data-manager';

const SREInstance = SmythRuntime.Instance.init({
    Account: {
        Connector: 'JSONFileAccount',
        Settings: {
            file: testData.getDataPath('account.json'),
        },
    },
});

describe('JSON Account Tests', () => {
    it('Smyth Account loaded', async () => {
        const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
        expect(jsonAccount).toBeInstanceOf(JSONFileAccount);
    });

    it('Verify user to be team member', async () => {
        const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
        const value = await jsonAccount.user('user1').isTeamMember('default');
        expect(value).toEqual(true);
    });

    it('Verify user not to be team member', async () => {
        const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
        const value = await jsonAccount.user('nonexistent-user').isTeamMember('default');
        expect(value).toEqual(false);
    });

    it('Verify correct team is returning for user', async () => {
        const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
        const team = await jsonAccount.user('user1').getCandidateTeam();
        expect(team).toEqual('default');
    });

    it('Verify correct team is returning for team', async () => {
        const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
        const team = await jsonAccount.team('default').getCandidateTeam();
        expect(team).toEqual('default');
    });

    it('Verify correct team is returning for agent', async () => {
        const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
        const team = await jsonAccount.agent('agent1').getCandidateTeam();
        expect(team).toEqual('default');
    });

    it('Verify all account settings are returning', async () => {
        const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
        const userSettings = await jsonAccount.user('user1').getAllUserSettings();
        const setting1 = userSettings.find((setting) => setting.key === 'setting1');
        expect(setting1).toEqual({ key: 'setting1', value: 'value1' });
    });

    it('Verify all team settings are returning', async () => {
        const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
        const teamSettings = await jsonAccount.team('default').getAllTeamSettings();
        const customLlmSettings = teamSettings.find((setting) => setting.key === 'custom-llm');
        expect(customLlmSettings).toBeDefined();
    });

    it('Verify specific account setting is returning', async () => {
        const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
        const userSettings = await jsonAccount.user('user1').getUserSetting('setting1');
        expect(userSettings).toEqual('value1');
    });

    it('Verify specific team setting is returning', async () => {
        const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
        const teamSettings = await jsonAccount.team('default').getTeamSetting('custom-llm');
        expect(teamSettings).toBeTypeOf('string');
    });

    it('Verify agent can access account setting', async () => {
        const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
        const team = await jsonAccount.agent('agent1').getCandidateTeam();
        const teamSettings = await jsonAccount.team(team).getTeamSetting('custom-llm');
        expect(teamSettings).toBeTypeOf('string');
    });

    it('Invalid setting key to be returned as null', async () => {
        const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
        const teamSettings = await jsonAccount.team('default').getTeamSetting('nonexistent-setting');
        expect(teamSettings).toBe('');
    });

    // Multi-team tests
    describe('Development Team Tests', () => {
        it('Verify development team user membership', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const value = await jsonAccount.user('dev-user1').isTeamMember('development');
            expect(value).toEqual(true);
        });

        it('Verify development team settings', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const teamSettings = await jsonAccount.team('development').getTeamSetting('api-endpoint');
            expect(teamSettings).toEqual('https://dev-api.smythos.com');
        });

        it('Verify development user settings', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const userSettings = await jsonAccount.user('dev-user1').getUserSetting('environment');
            expect(userSettings).toEqual('development');
        });

        it('Verify development agent settings', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const team = await jsonAccount.agent('dev-agent1').getCandidateTeam();
            expect(team).toEqual('development');
        });
    });

    describe('Production Team Tests', () => {
        it('Verify production team user membership', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const value = await jsonAccount.user('prod-user1').isTeamMember('production');
            expect(value).toEqual(true);
        });

        it('Verify production team settings', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const teamSettings = await jsonAccount.team('production').getTeamSetting('security-level');
            expect(teamSettings).toEqual('maximum');
        });

        it('Verify admin user access level', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const userSettings = await jsonAccount.user('admin-user').getUserSetting('access-level');
            expect(userSettings).toEqual('full');
        });

        it('Verify critical agent settings', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const agentSettings = await jsonAccount.agent('critical-agent').getAgentSetting('priority');
            expect(agentSettings).toEqual('high');
        });
    });

    describe('Cross-Team Access Tests', () => {
        it('Verify user cannot access wrong team', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const value = await jsonAccount.user('dev-user1').isTeamMember('production');
            expect(value).toEqual(false);
        });

        it('Verify default team user cannot access development team', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const value = await jsonAccount.user('user1').isTeamMember('development');
            expect(value).toEqual(false);
        });

        it('Verify production user cannot access development team', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const value = await jsonAccount.user('prod-user1').isTeamMember('development');
            expect(value).toEqual(false);
        });
    });

    describe('Team Isolation Tests', () => {
        it('Verify each team has different vault configurations', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const defaultVault = await jsonAccount.team('default').getTeamSetting('vault');
            const devVault = await jsonAccount.team('development').getTeamSetting('vault');
            const prodVault = await jsonAccount.team('production').getTeamSetting('vault');

            expect(defaultVault).toEqual('default-vault-config');
            expect(devVault).toEqual('dev-vault-config');
            expect(prodVault).toEqual('prod-vault-config');

            // Ensure they are all different
            expect(defaultVault).not.toEqual(devVault);
            expect(devVault).not.toEqual(prodVault);
            expect(defaultVault).not.toEqual(prodVault);
        });

        it('Verify teams have different API endpoints', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const devEndpoint = await jsonAccount.team('development').getTeamSetting('api-endpoint');
            const prodEndpoint = await jsonAccount.team('production').getTeamSetting('api-endpoint');

            expect(devEndpoint).toEqual('https://dev-api.smythos.com');
            expect(prodEndpoint).toEqual('https://api.smythos.com');
            expect(devEndpoint).not.toEqual(prodEndpoint);
        });

        it('Verify agents belong to correct teams', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const defaultAgentTeam = await jsonAccount.agent('agent1').getCandidateTeam();
            const devAgentTeam = await jsonAccount.agent('dev-agent1').getCandidateTeam();
            const prodAgentTeam = await jsonAccount.agent('prod-agent1').getCandidateTeam();

            expect(defaultAgentTeam).toEqual('default');
            expect(devAgentTeam).toEqual('development');
            expect(prodAgentTeam).toEqual('production');
        });
    });

    describe('Environment-Specific Settings Tests', () => {
        it('Verify environment-specific user settings', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const devUserEnv = await jsonAccount.user('dev-user1').getUserSetting('environment');
            const prodUserEnv = await jsonAccount.user('prod-user1').getUserSetting('environment');

            expect(devUserEnv).toEqual('development');
            expect(prodUserEnv).toEqual('production');
        });

        it('Verify role-based access settings', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const devUserRole = await jsonAccount.user('dev-user2').getUserSetting('role');
            const adminUserRole = await jsonAccount.user('admin-user').getUserSetting('role');

            expect(devUserRole).toEqual('developer');
            expect(adminUserRole).toEqual('administrator');
        });

        it('Verify agent mode settings across teams', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const devAgentMode = await jsonAccount.agent('dev-agent1').getAgentSetting('mode');
            const prodAgentMode = await jsonAccount.agent('prod-agent1').getAgentSetting('mode');

            expect(devAgentMode).toEqual('development');
            expect(prodAgentMode).toEqual('production');
        });
    });

    describe('Nonexistent Entity Tests', () => {
        it('Verify nonexistent user in any team returns false', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const defaultResult = await jsonAccount.user('nonexistent-user').isTeamMember('default');
            const devResult = await jsonAccount.user('nonexistent-user').isTeamMember('development');
            const prodResult = await jsonAccount.user('nonexistent-user').isTeamMember('production');

            expect(defaultResult).toEqual(false);
            expect(devResult).toEqual(false);
            expect(prodResult).toEqual(false);
        });

        it('Verify nonexistent team returns empty string for settings', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const teamSettings = await jsonAccount.team('nonexistent-team').getTeamSetting('any-setting');
            expect(teamSettings).toBe('');
        });

        it('Verify nonexistent agent returns "default" string for team result', async () => {
            const jsonAccount: AccountConnector = ConnectorService.getAccountConnector();
            const team = await jsonAccount.agent('nonexistent-agent').getCandidateTeam();
            expect(team).toBe('default');
        });
    });
});
