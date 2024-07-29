import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, IACL } from '@sre/types/ACL.types';
import { StorageData, StorageMetadata } from '@sre/types/Storage.types';

export interface INKVRequest {
    get(key: string): Promise<any>;
    set(key: string, value: StorageData): Promise<void>;
    delete(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
}

/**
 * NKV = Namespace-Key-Value Connector
 */
export abstract class NKVConnector extends SecureConnector {
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;
    public abstract user(candidate: IAccessCandidate): INKVRequest;

    protected abstract get(acRequest: AccessRequest, nsKey: string): Promise<any>;
    protected abstract set(acRequest: AccessRequest, nsKey: string, value: any): Promise<void>;

    protected abstract delete(acRequest: AccessRequest, nsKey: string): Promise<void>;
    protected abstract exists(acRequest: AccessRequest, nsKey: string): Promise<boolean>;
}
