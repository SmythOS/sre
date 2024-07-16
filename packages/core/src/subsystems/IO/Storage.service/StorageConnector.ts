import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, IACL } from '@sre/types/ACL.types';
import { StorageData, StorageMetadata } from '@sre/types/Storage.types';

export interface IStorageRequest {
    read(resourceId: string): Promise<StorageData>;
    write(resourceId: string, value: StorageData, acl?: IACL, metadata?: StorageMetadata): Promise<void>;
    delete(resourceId: string): Promise<void>;
    exists(resourceId: string): Promise<boolean>;
    getMetadata(resourceId: string): Promise<StorageMetadata | undefined>;
    setMetadata(resourceId: string, metadata: StorageMetadata): Promise<void>;
    getACL(resourceId: string): Promise<ACL | undefined>;
    setACL(resourceId: string, acl: IACL): Promise<void>;
}

export abstract class StorageConnector extends SecureConnector {
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;
    public abstract user(candidate: AccessCandidate): IStorageRequest;
    protected abstract read(resourceId: string, acRequest: AccessRequest): Promise<StorageData>;
    protected abstract write(resourceId: string, acRequest: AccessRequest, value: StorageData, acl?: IACL, metadata?: StorageMetadata): Promise<void>;
    protected abstract delete(resourceId: string, acRequest: AccessRequest): Promise<void>;
    protected abstract exists(resourceId: string, acRequest: AccessRequest): Promise<boolean>;

    protected abstract getMetadata(resourceId: string, acRequest: AccessRequest): Promise<StorageMetadata | undefined>;
    protected abstract setMetadata(resourceId: string, acRequest: AccessRequest, metadata: StorageMetadata): Promise<void>;

    protected abstract getACL(resourceId: string, acRequest: AccessRequest): Promise<ACL | undefined>;
    protected abstract setACL(resourceId: string, acRequest: AccessRequest, acl: IACL): Promise<void>;
}
