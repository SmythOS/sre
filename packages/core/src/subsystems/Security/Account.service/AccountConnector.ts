import { Connector } from '@sre/Core/Connector.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { AccessCandidate } from '../AccessControl/AccessCandidate.class';
import { KeyValueObject } from '@sre/types/Common.types';
import { ACL } from '../AccessControl/ACL.class';


export interface ISmythAccountRequest {
    isTeamMember(teamId: string): Promise<boolean>;
    getCandidateTeam(): Promise<string | undefined>;
    getAllTeamSettings(): Promise<KeyValueObject[]>;
    getAllUserSettings(): Promise<KeyValueObject[]>;
    getTeamSetting(settingKey: string): Promise<KeyValueObject>;
    getUserSetting(settingKey: string): Promise<KeyValueObject>;
}

export abstract class AccountConnector extends Connector {
    public abstract user(candidate: AccessCandidate): ISmythAccountRequest;
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;
    public abstract isTeamMember(teamId: string, candidate: IAccessCandidate): Promise<boolean>;
    public abstract getCandidateTeam(candidate: IAccessCandidate): Promise<string | undefined>;
    public abstract getAllTeamSettings(acRequest: AccessRequest, teamId: string): Promise<Object>;
    public abstract getAllUserSettings(acRequest: AccessRequest, accountId: string): Promise<Object>;
    public abstract getTeamSetting(acRequest: AccessRequest, teamId: string, settingKey: string): Promise<Object>;
    public abstract getUserSetting(acRequest: AccessRequest, accountId: string, settingKey: string): Promise<Object>;
}
