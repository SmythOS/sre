import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
//import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { OAuthConfig, SmythConfigs } from '@sre/types/Security.types';

import { getM2MToken } from '@sre/utils/oauth.utils';
import axios, { AxiosInstance } from 'axios';
import { ManagedVaultConnector } from '../ManagedVaultConnector';

const console = Logger('SmythManagedVault');
export class SmythManagedVault extends ManagedVaultConnector {
    public name: string = 'SmythManagedVault';
    private oAuthAppId: string;
    private oAuthAppSecret: string;
    private oAuthBaseUrl: string;
    private oAuthResource?: string;
    private oAuthScope?: string;
    private smythAPI: AxiosInstance;
    private vaultName: string;

    constructor(private config: SmythConfigs & OAuthConfig & { vaultName: string }) {
        super();
        //if (!SmythRuntime.Instance) throw new Error('SRE not initialized');

        this.oAuthAppId = config.oAuthAppID;
        this.oAuthAppSecret = config.oAuthAppSecret;
        this.oAuthBaseUrl = config.oAuthBaseUrl;
        this.oAuthResource = config.oAuthResource || '';
        this.oAuthScope = config.oAuthScope || '';
        this.smythAPI = axios.create({
            baseURL: `${config.smythAPIBaseUrl}`,
        });
        this.vaultName = config.vaultName || 'vault';
    }

    @SecureConnector.AccessControl
    protected async get(acRequest: AccessRequest, keyId: string) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
        const vaultSetting = await accountConnector.getTeamSetting(acRequest, teamId, this.vaultName);
        const vaultData = JSON.parse(vaultSetting || '{}');
        return vaultData[keyId];
    }

    @SecureConnector.AccessControl
    protected async set(acRequest: AccessRequest, keyId: string, value: string) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
        const vaultSetting = await accountConnector.getTeamSetting(acRequest, teamId, this.vaultName);
        const vaultData = JSON.parse(vaultSetting || '{}');
        vaultData[keyId] = value;
        await this.smythAPI.put(
            `/v1/teams/${teamId}/settings`,
            {
                settingKey: this.vaultName,
                settingValue: JSON.stringify(vaultData),
            },
            { headers: await this.getSmythRequestHeaders() },
        );
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, keyId: string) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
        const vaultSetting = await accountConnector.getTeamSetting(acRequest, teamId, this.vaultName);
        const vaultData = JSON.parse(vaultSetting || '{}');
        delete vaultData[keyId];
        await this.smythAPI.put(
            `/v1/teams/${teamId}/settings`,
            {
                settingKey: this.vaultName,
                settingValue: JSON.stringify(vaultData),
            },
            { headers: await this.getSmythRequestHeaders() },
        );
    }

    @SecureConnector.AccessControl
    protected async exists(acRequest: AccessRequest, keyId: string) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
        const vaultSetting = await accountConnector.getTeamSetting(acRequest, teamId, this.vaultName);
        const vaultData = JSON.parse(vaultSetting || '{}');
        return keyId in vaultData;
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(candidate);

        const acl = new ACL();

        acl.addAccess(TAccessRole.Team, teamId, TAccessLevel.Owner)
            .addAccess(TAccessRole.Team, teamId, TAccessLevel.Read)
            .addAccess(TAccessRole.Team, teamId, TAccessLevel.Write);

        return acl;
    }

    private async getSmythRequestHeaders() {
        return {
            Authorization: `Bearer ${await getM2MToken({
                baseUrl: this.oAuthBaseUrl,
                oauthAppId: this.oAuthAppId,
                oauthAppSecret: this.oAuthAppSecret,
                resource: this.oAuthResource,
                scope: this.oAuthScope,
            })}`,
        };
    }
}
