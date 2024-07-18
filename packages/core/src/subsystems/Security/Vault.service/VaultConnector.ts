import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, IACL } from '@sre/types/ACL.types';

export interface IVaultRequest {
    get(keyId: string): Promise<string>;
    set(keyId: string, value: string): Promise<void>;
    delete(keyId: string): Promise<void>;
    exists(keyId: string): Promise<boolean>;
}

export abstract class VaultConnector extends SecureConnector {
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;
    public abstract user(candidate: AccessCandidate): IVaultRequest;
    protected abstract get(acRequest: AccessRequest, keyId: string): Promise<string>;
    protected abstract set(acRequest: AccessRequest, keyId: string, value: string): Promise<void>;
    protected abstract delete(acRequest: AccessRequest, keyId: string): Promise<void>;
    protected abstract exists(acRequest: AccessRequest, keyId: string): Promise<boolean>;
}
