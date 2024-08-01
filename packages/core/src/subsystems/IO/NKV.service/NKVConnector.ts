import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, IACL } from '@sre/types/ACL.types';
import { StorageData, StorageMetadata } from '@sre/types/Storage.types';

export interface INKVRequest {
    get(namespace: string, key: string): Promise<StorageData>;
    set(namespace: string, key: string, value: StorageData): Promise<void>;
    delete(namespace: string, key: string): Promise<void>;
    exists(namespace: string, key: string): Promise<boolean>;
    deleteAll(namespace: string): Promise<void>;
    list(namespace: string): Promise<{ key: string; data: StorageData }[]>;
}

/**
 * NKV = Namespace-Key-Value Connector
 */
export abstract class NKVConnector extends SecureConnector {
    public user(candidate: AccessCandidate): INKVRequest {
        return {
            get: async (namespace: string, key: string) => this.get(candidate.readRequest, namespace, key),
            set: async (namespace: string, key: string, value: StorageData) => this.set(candidate.writeRequest, namespace, key, value),
            delete: async (namespace: string, key: string) => this.delete(candidate.writeRequest, namespace, key),
            exists: async (namespace: string, key: string) => this.exists(candidate.readRequest, namespace, key),
            deleteAll: async (namespace: string) => this.deleteAll(candidate.writeRequest, namespace),
            list: async (namespace: string) => this.list(candidate.readRequest, namespace),
        };
    }

    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;

    protected abstract get(acRequest: AccessRequest, namespace: string, key: string): Promise<StorageData>;
    protected abstract set(acRequest: AccessRequest, namespace: string, key: string, value: StorageData): Promise<void>;

    protected abstract delete(acRequest: AccessRequest, namespace: string, key: string): Promise<void>;
    protected abstract exists(acRequest: AccessRequest, namespace: string, key: string): Promise<boolean>;
    protected abstract deleteAll(acRequest: AccessRequest, namespace: string): Promise<void>;
    protected abstract list(acRequest: AccessRequest, namespace: string): Promise<{ key: string; data: StorageData }[]>;
}
