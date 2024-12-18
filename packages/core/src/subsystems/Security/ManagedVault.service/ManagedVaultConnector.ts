import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, IACL } from '@sre/types/ACL.types';

/**
 * The managed vault is a vault that is managed by the SRE, its keys are not visible to the user.
 * it's used to store generated tokens at runtime, like OAuth tokens
 */

export interface IManagedVaultRequest {
    get(keyId: string): Promise<string>;
    set(keyId: string, value: string): Promise<void>;
    delete(keyId: string): Promise<void>;
    exists(keyId: string): Promise<boolean>;
}

export abstract class ManagedVaultConnector extends SecureConnector {
    user(candidate: AccessCandidate): IManagedVaultRequest {
        return {
            get: async (keyId: string) => this.get(candidate.readRequest, keyId),
            set: async (keyId: string, value: string) => this.set(candidate.writeRequest, keyId, value),
            delete: async (keyId: string) => this.delete(candidate.writeRequest, keyId),
            exists: async (keyId: string) => this.exists(candidate.readRequest, keyId),
        };
    }

    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;
    protected abstract get(acRequest: AccessRequest, keyId: string): Promise<string>;
    protected abstract set(acRequest: AccessRequest, keyId: string, value: string): Promise<void>;
    protected abstract delete(acRequest: AccessRequest, keyId: string): Promise<void>;
    protected abstract exists(acRequest: AccessRequest, keyId: string): Promise<boolean>;
}
