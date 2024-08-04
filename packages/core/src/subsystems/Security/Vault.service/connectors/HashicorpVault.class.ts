import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { IVaultRequest, VaultConnector } from '../VaultConnector';

const console = Logger('HashicorpVault');
export class HashicorpVault extends VaultConnector {
    public name: string = 'HashicorpVault';

    constructor(private config: any) {
        super();
        //hashicorp client/api
    }

    user(candidate: AccessCandidate): IVaultRequest {
        return {
            get: async (keyId: string) => this.get(candidate.readRequest, keyId),
            set: async (keyId: string, value: string) => this.set(candidate.writeRequest, keyId, value),
            delete: async (keyId: string) => this.delete(candidate.writeRequest, keyId),
            exists: async (keyId: string) => this.exists(candidate.readRequest, keyId),
        };
    }

    @SecureConnector.AccessControl
    protected async get(acRequest: AccessRequest, keyId: string) {
        return null;
    }

    @SecureConnector.AccessControl
    protected async set(acRequest: AccessRequest, keyId: string, value: string) {
        throw new Error('HashicorpVault.set not allowed');
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, keyId: string) {
        throw new Error('HashicorpVault.delete not allowed');
    }

    @SecureConnector.AccessControl
    protected async exists(acRequest: AccessRequest, keyId: string) {
        return false;
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate) {
        //FIXME : this is for dev, it always give full access, we must update the logic
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(candidate);
        const acl = new ACL();

        acl.addAccess(TAccessRole.Team, teamId, TAccessLevel.Owner)
            .addAccess(TAccessRole.Team, teamId, TAccessLevel.Read)
            .addAccess(TAccessRole.Team, teamId, TAccessLevel.Write);

        return acl;
    }
}
