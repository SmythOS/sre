import { Connector } from '@sre/Core/Connector.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, IACL, TAccessRole } from '@sre/types/ACL.types';
import { StorageData, StorageMetadata } from '@sre/types/Storage.types';
import { AccountConnector } from '../AccountConnector';
import { KeyValueObject } from '@sre/types/Common.types';

export class DummyAccount extends AccountConnector {
    public name = 'DummyAccount';
    public isTeamMember(team: string, candidate: IAccessCandidate): Promise<boolean> {
        return Promise.resolve(true);
    }
    public getCandidateTeam(candidate: IAccessCandidate): Promise<string | undefined> {
        if (candidate.role === TAccessRole.Team) {
            return Promise.resolve(candidate.id);
        }

        return Promise.resolve('default');
    }

    public getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        throw new Error('getResourceACL Method not implemented.');
    }
    public getAllTeamSettings(acRequest: AccessRequest, teamId: string): Promise<KeyValueObject[]> {
        throw new Error('getAllTeamSettings Method not implemented.');
    }
    public getAllUserSettings(acRequest: AccessRequest, accountId: string): Promise<KeyValueObject[]> {
        throw new Error('getAllUserSettings Method not implemented.');
    }
    public getTeamSetting(acRequest: AccessRequest, teamId: string, settingKey: string): Promise<string> {
        throw new Error('getTeamSetting Method not implemented.');
    }
    public getUserSetting(acRequest: AccessRequest, accountId: string, settingKey: string): Promise<string> {
        throw new Error('getUserSetting Method not implemented.');
    }
}
