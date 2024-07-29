import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, IACL } from '@sre/types/ACL.types';
import { IVectorDataSourceDto, QueryOptions, Source, VectorDBMetadata, VectorsResultData } from '@sre/types/VectorDB.types';
import { Document } from '@langchain/core/documents';

export interface IVectorDBRequest {
    search(namespace: string, query: string | number[], options?: QueryOptions): Promise<VectorsResultData>;
    insert(namespace: string, source: IVectorDataSourceDto | IVectorDataSourceDto[]): Promise<string[]>;
    delete(namespace: string, id: string | string[]): Promise<void>;
    createNamespace(namespace: string): Promise<void>;
    deleteNamespace(namespace: string): Promise<void>;
}

export abstract class VectorDBConnector extends SecureConnector {
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;
    public abstract user(candidate: IAccessCandidate): IVectorDBRequest;

    protected abstract search(
        acRequest: AccessRequest,
        data: { indexName: string; namespace: string; query: string | number[] },
        options: QueryOptions
    ): Promise<VectorsResultData>;

    protected abstract insert(
        acRequest: AccessRequest,
        data: {
            indexName: string;
            namespace: string;
            source: IVectorDataSourceDto | IVectorDataSourceDto[];
        }
    ): Promise<string[]>;

    protected abstract delete(acRequest: AccessRequest, data: { id: string | string[]; indexName: string; namespace: string }): Promise<void>;

    protected abstract createNamespace(acRequest: AccessRequest, namespace: string, indexName: string): Promise<void>;

    protected abstract deleteNamespace(acRequest: AccessRequest, namespace: string, indexName: string): Promise<void>;

    // protected abstract updateVectors(acRequest: AccessRequest, resourceId: string): Promise<void>;

    // protected abstract getMetadata(acRequest: AccessRequest, resourceId: string): Promise<StorageMetadata | undefined>;
    // protected abstract setMetadata(acRequest: AccessRequest, resourceId: string, metadata: StorageMetadata): Promise<void>;

    // protected abstract getACL(acRequest: AccessRequest, resourceId: string): Promise<ACL | undefined>;
    // protected abstract setACL(acRequest: AccessRequest, resourceId: string, acl: IACL): Promise<void>;
}
