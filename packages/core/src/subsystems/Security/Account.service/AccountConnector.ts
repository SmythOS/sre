import { Connector } from '@sre/Core/Connector.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { IAccessCandidate, TAccessRole } from '@sre/types/ACL.types';
import { AccessCandidate } from '../AccessControl/AccessCandidate.class';
import { KeyValueObject } from '@sre/types/Common.types';
import { ACL } from '../AccessControl/ACL.class';

export interface ISmythAccountRequest {
    isTeamMember(teamId: string): Promise<boolean>;
    getCandidateTeam(): Promise<string | undefined>;
    getAllTeamSettings(): Promise<KeyValueObject>;
    getAllUserSettings(): Promise<KeyValueObject>;
    getTeamSetting(settingKey: string, group?: string): Promise<string>;
    getUserSetting(settingKey: string): Promise<string>;
    getAgentSetting(settingKey: string): Promise<string>;
    getTeam(): Promise<string>;
}

export abstract class AccountConnector extends Connector {
    constructor(protected _settings?: any) {
        super(_settings);
    }
    public requester(candidate: AccessCandidate): ISmythAccountRequest {
        return {
            getAllUserSettings: async () => this.getAllUserSettings(candidate.readRequest, candidate.id),
            getUserSetting: async (settingKey: string) => this.getUserSetting(candidate.readRequest, candidate.id, settingKey),
            getAllTeamSettings: async () => this.getAllTeamSettings(candidate.readRequest, candidate.id),
            getTeamSetting: async (settingKey: string, group?: string) => this.getTeamSetting(candidate.readRequest, candidate.id, settingKey, group),
            isTeamMember: async (teamId: string) => this.isTeamMember(teamId, candidate),
            getCandidateTeam: async () => this.getCandidateTeam(candidate),
            getTeam: async () => this.getCandidateTeam(candidate),
            getAgentSetting: async (settingKey: string) => this.getAgentSetting(candidate.readRequest, candidate.id, settingKey),
        };
    }
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;

    public abstract isTeamMember(teamId: string, candidate: IAccessCandidate): Promise<boolean>;
    public abstract getCandidateTeam(candidate: IAccessCandidate): Promise<string | undefined>;
    public abstract getAllTeamSettings(acRequest: AccessRequest, teamId: string): Promise<KeyValueObject>;
    public abstract getAllUserSettings(acRequest: AccessRequest, accountId: string): Promise<KeyValueObject>;
    public abstract getTeamSetting(acRequest: AccessRequest, teamId: string, settingKey: string, group?: string): Promise<string>;
    public abstract getUserSetting(acRequest: AccessRequest, accountId: string, settingKey: string): Promise<string>;
    public abstract getAgentSetting(acRequest: AccessRequest, agentId: string, settingKey: string): Promise<string>;
}
