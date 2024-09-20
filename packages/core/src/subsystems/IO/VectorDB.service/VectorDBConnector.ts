import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, IACL } from '@sre/types/ACL.types';
import {
    IStorageVectorNamespace,
    IVectorDataSourceDto,
    QueryOptions,
    Source,
    StorageVectorNamespaceMetadata,
    VectorDBMetadata,
    VectorsResultData,
} from '@sre/types/VectorDB.types';
import { Document } from '@langchain/core/documents';

export interface IVectorDBRequest {
    search(namespace: string, query: string | number[], options?: QueryOptions): Promise<VectorsResultData>;
    insert(namespace: string, source: IVectorDataSourceDto | IVectorDataSourceDto[]): Promise<string[]>;
    delete(namespace: string, id: string | string[]): Promise<void>;
    createNamespace(namespace: string, metadata?: { [key: string]: any }): Promise<void>;
    deleteNamespace(namespace: string): Promise<void>;
    namespaceExists(namespace: string): Promise<boolean>;
    listNamespaces(): Promise<any[]>;
    getNamespace(namespace: string): Promise<any>;
    getNsMetadata(namespace: string): Promise<StorageVectorNamespaceMetadata>;
}

export abstract class VectorDBConnector extends SecureConnector {
    public abstract id: string;
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;

    public user(candidate: AccessCandidate): IVectorDBRequest {
        return {
            search: async (namespace: string, query: string | number[], options: QueryOptions) => {
                return await this.search(candidate.readRequest, namespace, query, options);
            },

            insert: async (namespace: string, source: IVectorDataSourceDto | IVectorDataSourceDto[]) => {
                return this.insert(candidate.writeRequest, namespace, source);
            },

            delete: async (namespace: string, id: string | string[]) => {
                await this.delete(candidate.writeRequest, namespace, id);
            },
            createNamespace: async (namespace: string, metadata?: { [key: string]: any }) => {
                await this.createNamespace(candidate.writeRequest, namespace, metadata);
            },
            deleteNamespace: async (namespace: string) => {
                await this.deleteNamespace(candidate.writeRequest, namespace);
            },
            listNamespaces: async () => {
                return await this.listNamespaces(candidate.readRequest);
            },
            namespaceExists: async (namespace: string) => {
                return await this.namespaceExists(candidate.readRequest, namespace);
            },
            getNamespace: async (namespace: string) => {
                return await this.getNamespace(candidate.readRequest, namespace);
            },
            getNsMetadata: async (namespace: string) => {
                return this.getNsMetadata(candidate.readRequest, namespace);
            },
        };
    }

    protected abstract search(
        acRequest: AccessRequest,
        namespace: string,
        query: string | number[],

        options: QueryOptions
    ): Promise<VectorsResultData>;

    protected abstract insert(acRequest: AccessRequest, namespace: string, source: IVectorDataSourceDto | IVectorDataSourceDto[]): Promise<string[]>;

    protected abstract delete(acRequest: AccessRequest, namespace: string, id: string | string[]): Promise<void>;

    protected abstract createNamespace(
        acRequest: AccessRequest,
        namespace: string,

        metadata?: { [key: string]: any }
    ): Promise<void>;

    protected abstract deleteNamespace(acRequest: AccessRequest, namespace: string): Promise<void>;

    protected abstract listNamespaces(acRequest: AccessRequest): Promise<any[]>;

    protected abstract namespaceExists(acRequest: AccessRequest, namespace: string): Promise<boolean>;

    protected abstract getNamespace(acRequest: AccessRequest, namespace: string): Promise<IStorageVectorNamespace>;

    protected abstract getNsMetadata(acRequest: AccessRequest, namespace: string): Promise<StorageVectorNamespaceMetadata>;

    // protected abstract updateVectors(acRequest: AccessRequest, resourceId: string): Promise<void>;

    // protected abstract getMetadata(acRequest: AccessRequest, resourceId: string): Promise<StorageMetadata | undefined>;
    // protected abstract setMetadata(acRequest: AccessRequest, resourceId: string, metadata: StorageMetadata): Promise<void>;

    // protected abstract getACL(acRequest: AccessRequest, resourceId: string): Promise<ACL | undefined>;
    // protected abstract setACL(acRequest: AccessRequest, resourceId: string, acl: IACL): Promise<void>;

    public static constructNsName(name: string, teamId: string) {
        return `${teamId}::${name}`;
    }

    public static parseNsName(nsName: string) {
        const parts = nsName.split('::');
        if (parts.length != 2) return null;
        return {
            teamId: parts[0],
            name: parts[1],
        };
    }
}
