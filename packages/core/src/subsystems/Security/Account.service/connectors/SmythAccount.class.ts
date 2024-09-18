import { Logger } from "@sre/helpers/Log.helper";
import { ISmythAccountRequest, AccountConnector } from "../AccountConnector";
import { IAccessCandidate, TAccessLevel, TAccessRole } from "@sre/types/ACL.types";
import { AccessRequest } from "@sre/Security/AccessControl/AccessRequest.class";
import { AccessCandidate } from "@sre/Security/AccessControl/AccessCandidate.class";
import { OAuthConfig, SmythConfigs } from "@sre/types/Security.types";
import axios, { AxiosInstance } from "axios";
import SmythRuntime from "@sre/Core/SmythRuntime.class";
import { getM2MToken } from "@sre/utils/oauth.utils";
import { KeyValueObject } from "@sre/types/Common.types";
import { ConnectorService } from "@sre/Core/ConnectorsService";
import { ACL } from "@sre/Security/AccessControl/ACL.class";


const console = Logger('SmythAccount');
export class SmythAccount extends AccountConnector {
    public name: string = 'SmythAccount';
    private oAuthAppId: string;
    private oAuthAppSecret: string;
    private oAuthBaseUrl: string;
    private oAuthResource?: string;
    private oAuthScope?: string;
    private smythAPI: AxiosInstance;

    constructor(private config: SmythConfigs & OAuthConfig) {
        super();
        if (!SmythRuntime.Instance) throw new Error('SRE not initialized');

        this.oAuthAppId = config.oAuthAppID;
        this.oAuthAppSecret = config.oAuthAppSecret;
        this.oAuthBaseUrl = config.oAuthBaseUrl;
        this.oAuthResource = config.oAuthResource || '';
        this.oAuthScope = config.oAuthScope || '';
        this.smythAPI = axios.create({
            baseURL: `${config.smythAPIBaseUrl}`,
        });
    }

    user(candidate: AccessCandidate): ISmythAccountRequest {
        return {
            getAccountAllSettings: async () => this.getAccountAllSettings(candidate.readRequest, candidate.id),
            getAccountSetting: async (settingKey: string) => this.getAccountSetting(candidate.readRequest, candidate.id, settingKey),
            getTeamAllSettings: async () => this.getTeamAllSettings(candidate.readRequest, candidate.id),
            getTeamSetting: async (settingKey: string) => this.getTeamSetting(candidate.readRequest, candidate.id, settingKey),
            isTeamMember: async (teamId: string) => this.isTeamMember(teamId, candidate),
            getCandidateTeam: async () => this.getCandidateTeam(candidate),
        };
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

    public async getTeamAllSettings(acRequest: AccessRequest, teamId: string): Promise<KeyValueObject[] | null> {
        try {
            const response = await this.smythAPI.get(`/v1/teams/${teamId}/settings`, { headers: await this.getSmythRequestHeaders() });
            return response?.data?.settings;
        } catch (error) {
            return null;
        }
    }

    public async getAccountAllSettings(acRequest: AccessRequest, accountId: string): Promise<KeyValueObject[] | null> {
        try {
            const response = await this.smythAPI.get(`/v1/user/${accountId}/settings`, { headers: await this.getSmythRequestHeaders() });
            return response?.data?.settings;
        } catch (error) {
            return null;
        }
    }


    public async getTeamSetting(acRequest: AccessRequest, teamId: string, settingKey: string): Promise<KeyValueObject> {
        try {
            const response = await this.smythAPI.get(`/v1/teams/${teamId}/settings/${settingKey}`, { headers: await this.getSmythRequestHeaders() });
            return response?.data?.setting;
        } catch (error) {
            return null;
        }
    }

    public async getAccountSetting(acRequest: AccessRequest, accountId: string, settingKey: string): Promise<KeyValueObject> {
        try {
            const response = await this.smythAPI.get(`/v1/user/${accountId}/settings/${settingKey}`, { headers: await this.getSmythRequestHeaders() });
            return response?.data?.setting;
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
            })}`
        };
    }
}