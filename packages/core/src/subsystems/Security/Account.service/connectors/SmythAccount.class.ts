import { Logger } from '@sre/helpers/Log.helper';
import { ISmythAccountRequest, AccountConnector } from '../AccountConnector';
import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { OAuthConfig, SmythConfigs } from '@sre/types/Security.types';
import axios, { AxiosInstance } from 'axios';
//import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { getM2MToken } from '@sre/utils/oauth.utils';
import { KeyValueObject } from '@sre/types/Common.types';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { ACL } from '@sre/Security/AccessControl/ACL.class';

const console = Logger('SmythAccount');
export class SmythAccount extends AccountConnector {
    public name: string = 'SmythAccount';
    private oAuthAppId: string;
    private oAuthAppSecret: string;
    private oAuthBaseUrl: string;
    private oAuthResource?: string;
    private oAuthScope?: string;
    private smythAPI: AxiosInstance;

    constructor(protected _settings: SmythConfigs & OAuthConfig) {
        super(_settings);
        //if (!SmythRuntime.Instance) throw new Error('SRE not initialized');

        this.oAuthAppId = _settings.oAuthAppID;
        this.oAuthAppSecret = _settings.oAuthAppSecret;
        this.oAuthBaseUrl = _settings.oAuthBaseUrl;
        this.oAuthResource = _settings.oAuthResource || '';
        this.oAuthScope = _settings.oAuthScope || '';
        this.smythAPI = axios.create({
            baseURL: `${_settings.smythAPIBaseUrl}`,
        });
    }

    public async isTeamMember(teamId: string, candidate: IAccessCandidate): Promise<boolean> {
        try {
            const candidateTeamId = await this.getCandidateTeam(candidate);
            if (teamId === candidateTeamId) {
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    public async getCandidateTeam(candidate: IAccessCandidate): Promise<string | undefined> {
        if (candidate.role === TAccessRole.Team) {
            return candidate.id;
        }
        if (candidate.role === TAccessRole.User) {
            const response = await this.smythAPI.get(`/v1/user/${candidate.id}`, { headers: await this.getSmythRequestHeaders() });
            return response?.data?.user?.teamId;
        }
        if (candidate.role === TAccessRole.Agent) {
            const response = await this.smythAPI.get(`/v1/ai-agent/${candidate.id}`, { headers: await this.getSmythRequestHeaders() });
            return response?.data?.agent?.teamId;
        }
        return null;
    }

    public async getAllTeamSettings(acRequest: AccessRequest, teamId: string): Promise<KeyValueObject | null> {
        try {
            const response = await this.smythAPI.get(`/v1/teams/${teamId}/settings`, { headers: await this.getSmythRequestHeaders() });

            if (response?.data?.settings?.length > 0) {
                const settingsObject: KeyValueObject = {};
                response?.data?.settings?.forEach((setting: KeyValueObject) => {
                    settingsObject[setting?.settingKey] = setting?.settingValue;
                });
                return settingsObject;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    public async getAllUserSettings(acRequest: AccessRequest, accountId: string): Promise<KeyValueObject | null> {
        try {
            const response = await this.smythAPI.get(`/v1/user/${accountId}/settings`, { headers: await this.getSmythRequestHeaders() });

            if (response?.data?.settings?.length > 0) {
                const settingsObject: KeyValueObject = {};
                response?.data?.settings?.forEach((setting: KeyValueObject) => {
                    settingsObject[setting?.settingKey] = setting?.settingValue;
                });
                return settingsObject;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    public async getTeamSetting(acRequest: AccessRequest, teamId: string, settingKey: string): Promise<string> {
        try {
            const response = await this.smythAPI.get(`/v1/teams/${teamId}/settings/${settingKey}`, { headers: await this.getSmythRequestHeaders() });
            return response?.data?.setting?.settingValue || null;
        } catch (error) {
            return null;
        }
    }

    public async getUserSetting(acRequest: AccessRequest, accountId: string, settingKey: string): Promise<string> {
        try {
            const response = await this.smythAPI.get(`/v1/user/${accountId}/settings/${settingKey}`, {
                headers: await this.getSmythRequestHeaders(),
            });
            return response?.data?.setting?.settingValue || null;
        } catch (error) {
            return null;
        }
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate) {
        const accountConnector = ConnectorService.getAccountConnector('SmythAccount');
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

    public async getAgentSetting(acRequest: AccessRequest, agentId: string, settingKey: string): Promise<string> {
        try {
            // TODO: use following endpoint when Ahmed make it available
            // const response = await this.smythAPI.get(`/v1/ai-agent/${agentId}/settings/${settingKey}`, {
            //     headers: await this.getSmythRequestHeaders(),
            // });

            const response = await this.smythAPI.get(`/v1/ai-agent/${agentId}/settings/`, {
                headers: await this.getSmythRequestHeaders(),
            });
            const setting = response?.data?.settings?.find((setting: KeyValueObject) => setting?.key === settingKey) || null;
            return setting?.value || '';
        } catch (error) {
            return '';
        }
    }
}
