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

    protected abstract read(acRequest: AccessRequest, resourceId: string): Promise<StorageData>;
    protected abstract write(acRequest: AccessRequest, resourceId: string, value: StorageData, acl?: IACL, metadata?: StorageMetadata): Promise<void>;
    protected abstract delete(acRequest: AccessRequest, resourceId: string): Promise<void>;
    protected abstract exists(acRequest: AccessRequest, resourceId: string): Promise<boolean>;

    protected abstract getMetadata(acRequest: AccessRequest, resourceId: string): Promise<StorageMetadata | undefined>;
    protected abstract setMetadata(acRequest: AccessRequest, resourceId: string, metadata: StorageMetadata): Promise<void>;

    protected abstract getACL(acRequest: AccessRequest, resourceId: string): Promise<ACL | undefined>;
    protected abstract setACL(acRequest: AccessRequest, resourceId: string, acl: IACL): Promise<void>;

    public user(candidate: AccessCandidate): IStorageRequest {
        return {
            write: async (resourceId: string, value: StorageData, acl?: IACL, metadata?: StorageMetadata) => {
                return await this.write(candidate.writeRequest, resourceId, value, acl, metadata);
            },
            read: async (resourceId: string) => {
                return await this.read(candidate.readRequest, resourceId);
            },
            delete: async (resourceId: string) => {
                await this.delete(candidate.readRequest, resourceId);
            },
            exists: async (resourceId: string) => {
                return await this.exists(candidate.readRequest, resourceId);
            },
            getMetadata: async (resourceId: string) => {
                return await this.getMetadata(candidate.readRequest, resourceId);
            },
            setMetadata: async (resourceId: string, metadata: StorageMetadata) => {
                await this.setMetadata(candidate.writeRequest, resourceId, metadata);
            },
            getACL: async (resourceId: string) => {
                return await this.getACL(candidate.readRequest, resourceId);
            },
            setACL: async (resourceId: string, acl: IACL) => {
                return await this.setACL(candidate.writeRequest, resourceId, acl);
            },
        } as IStorageRequest;
    }
}
