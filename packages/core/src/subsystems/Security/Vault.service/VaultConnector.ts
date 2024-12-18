import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, IACL } from '@sre/types/ACL.types';

export interface IVaultRequest {
    get(keyId: string): Promise<string>;
    exists(keyId: string): Promise<boolean>;
    listKeys(): Promise<string[]>;
}

export abstract class VaultConnector extends SecureConnector {
    user(candidate: AccessCandidate): IVaultRequest {
        return {
            get: async (keyId: string) => this.get(candidate.readRequest, keyId),
            exists: async (keyId: string) => this.exists(candidate.readRequest, keyId),
            listKeys: async () => this.listKeys(candidate.readRequest),
        };
    }

    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;
    protected abstract get(acRequest: AccessRequest, keyId: string): Promise<string>;
    protected abstract exists(acRequest: AccessRequest, keyId: string): Promise<boolean>;
    protected abstract listKeys(acRequest: AccessRequest): Promise<string[]>;
}
