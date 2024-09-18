import { Connector } from '@sre/Core/Connector.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { AccessCandidate } from '../AccessControl/AccessCandidate.class';
import { KeyValueObject } from '@sre/types/Common.types';
import { ACL } from '../AccessControl/ACL.class';


export interface ISmythAccountRequest {
    isTeamMember(teamId: string): Promise<boolean>;
    getCandidateTeam(): Promise<string | undefined>;
    getTeamAllSettings(): Promise<KeyValueObject[]>;
    getAccountAllSettings(): Promise<KeyValueObject[]>;
    getTeamSetting(settingKey: string): Promise<KeyValueObject>;
    getAccountSetting(settingKey: string): Promise<KeyValueObject>;
}

export abstract class AccountConnector extends Connector {
    public abstract user(candidate: AccessCandidate): ISmythAccountRequest;
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;
    public abstract isTeamMember(teamId: string, candidate: IAccessCandidate): Promise<boolean>;
    public abstract getCandidateTeam(candidate: IAccessCandidate): Promise<string | undefined>;
    public abstract getTeamAllSettings(acRequest: AccessRequest, teamId: string): Promise<Object>;
    public abstract getAccountAllSettings(acRequest: AccessRequest, accountId: string): Promise<Object>;
    public abstract getTeamSetting(acRequest: AccessRequest, teamId: string, settingKey: string): Promise<Object>;
    public abstract getAccountSetting(acRequest: AccessRequest, accountId: string, settingKey: string): Promise<Object>;
}
