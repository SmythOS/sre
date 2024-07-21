import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, IACL } from '@sre/types/ACL.types';
import { VectorDBMetadata, VectorsResultData } from '@sre/types/VectorDB.types';

export interface IVectorDBRequest {
    search(data: { namespace: string; query: string; topK: string }): Promise<VectorsResultData>;
    insertVectors(data: { namespace: string; vectors: { id: string; vector: number[] }[]; acl?: IACL; metadata?: VectorDBMetadata }): Promise<void>;
    deleteVectors(data: { ids: string[]; namespace?: string }): Promise<void>;
}

export abstract class VectorDBConnector extends SecureConnector {
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;
    public abstract user(candidate: IAccessCandidate): IVectorDBRequest;

    protected abstract search(
        acRequest: AccessRequest,
        data: { indexName: string; namespace: string; query: string; topK: string }
    ): Promise<{ [key: string]: any }[]>;

    protected abstract insertVectors(
        acRequest: AccessRequest,
        data: {
            indexName: string;
            namespace: string;
            vectors: { id: string; vector: number[] }[];
            acl?: IACL;
            metadata?: VectorDBMetadata;
        }
    ): Promise<void>;

    protected abstract deleteVectors(acRequest: AccessRequest, data: { ids: string[]; indexName: string; namespace?: string }): Promise<void>;

    // protected abstract updateVectors(acRequest: AccessRequest, resourceId: string): Promise<void>;

    // protected abstract getMetadata(acRequest: AccessRequest, resourceId: string): Promise<StorageMetadata | undefined>;
    // protected abstract setMetadata(acRequest: AccessRequest, resourceId: string, metadata: StorageMetadata): Promise<void>;

    // protected abstract getACL(acRequest: AccessRequest, resourceId: string): Promise<ACL | undefined>;
    // protected abstract setACL(acRequest: AccessRequest, resourceId: string, acl: IACL): Promise<void>;
}
