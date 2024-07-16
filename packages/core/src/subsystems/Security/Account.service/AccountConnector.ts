import { Connector } from '@sre/Core/Connector.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, IACL, TAccessRole } from '@sre/types/ACL.types';
import { StorageData, StorageMetadata } from '@sre/types/Storage.types';

export abstract class AccountConnector extends Connector {
    public name = 'Account';
    public isTeamMember(team: string, candidate: IAccessCandidate): Promise<boolean> {
        return Promise.resolve(true);
    }
    public getCandidateTeam(candidate: IAccessCandidate): Promise<string | undefined> {
        if (candidate.role === TAccessRole.Team) {
            return Promise.resolve(candidate.id);
        }

        return Promise.resolve('default');
    }
}
