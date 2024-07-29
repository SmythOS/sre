import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { INKVRequest, NKVConnector } from '../NKVConnector';
import { IAccessCandidate, TAccessLevel } from '@sre/types/ACL.types';
import { ACL } from '@sre/Security/AccessControl/ACL.class';

export class NKVRedis extends NKVConnector {
    public name = 'Redis';

    public user(candidate: IAccessCandidate): INKVRequest {
        throw new Error('Method not implemented.');
    }

    protected async get(acRequest: AccessRequest, nsKey: string) {
        throw new Error('Method not implemented.');
    }
    protected async set(acRequest: AccessRequest, nsKey: string, value: any) {
        throw new Error('Method not implemented.');
    }
    protected async delete(acRequest: AccessRequest, nsKey: string) {
        throw new Error('Method not implemented.');
    }
    protected async exists(acRequest: AccessRequest, nsKey: string): Promise<boolean> {
        throw new Error('Method not implemented.');
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
    }
}
