import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccountConnector, ISmythAccountRequest } from '@sre/Security/Account.service/AccountConnector';
import { IAccessCandidate, TAccessRole } from '@sre/types/ACL.types';

export class TestAccountConnector extends AccountConnector {
    public user(candidate: AccessCandidate): ISmythAccountRequest {
        throw new Error('Method not implemented.');
    }
    public getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        throw new Error('Method not implemented.');
    }
    public isTeamMember(teamId: string, candidate: IAccessCandidate): Promise<boolean> {
        return Promise.resolve(true);
    }
    public getAllTeamSettings(acRequest: AccessRequest, teamId: string): Promise<Object> {
        throw new Error('Method not implemented.');
    }
    public getAllUserSettings(acRequest: AccessRequest, accountId: string): Promise<Object> {
        throw new Error('Method not implemented.');
    }
    public getAgentSetting(acRequest: AccessRequest, agentId: string, settingKey: string): Promise<string> {
        throw new Error('Method not implemented.');
    }
    public getTeamSetting(acRequest: AccessRequest, teamId: string, settingKey: string): Promise<string> {
        throw new Error('Method not implemented.');
    }
    public getUserSetting(acRequest: AccessRequest, accountId: string, settingKey: string): Promise<string> {
        throw new Error('Method not implemented.');
    }
    public getCandidateTeam(candidate: IAccessCandidate): Promise<string | undefined> {
        if (candidate.role === TAccessRole.Team) {
            return Promise.resolve(candidate.id);
        }

        return Promise.resolve('default');
    }
}
