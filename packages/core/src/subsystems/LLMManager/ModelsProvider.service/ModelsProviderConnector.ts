import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate } from '@sre/types/ACL.types';

export interface IModelsProvider {
    getModels(): Promise<any>;
}
export abstract class ModelsProviderConnector extends SecureConnector {
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;

    public abstract getModels(acRequest: AccessRequest): Promise<any>;

    public user(candidate: AccessCandidate): IModelsProvider {
        return {
            getModels: async () => this.getModels(candidate.readRequest),
        };
    }
}
