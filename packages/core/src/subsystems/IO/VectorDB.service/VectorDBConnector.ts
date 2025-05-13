import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, IACL } from '@sre/types/ACL.types';
import {
    DatasourceDto,
    IStorageVectorDataSource,
    IStorageVectorNamespace,
    IVectorDataSourceDto,
    QueryOptions,
    Source,
    StorageVectorNamespaceMetadata,
    VectorDBMetadata,
    VectorsResultData,
} from '@sre/types/VectorDB.types';

export interface IVectorDBRequest {
    search(namespace: string, query: string | number[], options?: QueryOptions): Promise<VectorsResultData>;
    // insert(namespace: string, source: IVectorDataSourceDto | IVectorDataSourceDto[]): Promise<string[]>;
    // delete(namespace: string, id: string | string[]): Promise<void>;

    createDatasource(namespace: string, datasource: DatasourceDto): Promise<{ id: string; vectorIds: string[] }>;
    deleteDatasource(namespace: string, datasourceId: string): Promise<void>;
    listDatasources(namespace: string): Promise<{ id: string; data: IStorageVectorDataSource }[]>;
    getDatasource(namespace: string, datasourceId: string): Promise<IStorageVectorDataSource>;

    createNamespace(namespace: string, metadata?: { [key: string]: any }): Promise<void>;
    deleteNamespace(namespace: string): Promise<void>;
    namespaceExists(namespace: string): Promise<boolean>;
    listNamespaces(): Promise<IStorageVectorNamespace[]>;
    getNamespace(namespace: string): Promise<IStorageVectorNamespace>;
}

export abstract class VectorDBConnector extends SecureConnector {
    public abstract id: string;
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;

    public user(candidate: AccessCandidate): IVectorDBRequest {
        return {
            search: async (namespace: string, query: string | number[], options: QueryOptions) => {
                return await this.search(candidate.readRequest, namespace, query, options);
            },

            createDatasource: async (namespace: string, datasource: DatasourceDto) => {
                return await this.createDatasource(candidate.writeRequest, namespace, datasource);
            },
            deleteDatasource: async (namespace: string, datasourceId: string) => {
                await this.deleteDatasource(candidate.writeRequest, namespace, datasourceId);
            },
            listDatasources: async (namespace: string) => {
                return await this.listDatasources(candidate.readRequest, namespace);
            },
            getDatasource: async (namespace: string, datasourceId: string) => {
                return await this.getDatasource(candidate.readRequest, namespace, datasourceId);
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

    protected abstract createDatasource(
        acRequest: AccessRequest,
        namespace: string,
        datasource: DatasourceDto
    ): Promise<{ id: string; vectorIds: string[] }>;

    protected abstract deleteDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<void>;

    protected abstract listDatasources(acRequest: AccessRequest, namespace: string): Promise<{ id: string; data: IStorageVectorDataSource }[]>;

    protected abstract getDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<IStorageVectorDataSource>;

    protected abstract createNamespace(
        acRequest: AccessRequest,
        namespace: string,

        metadata?: { [key: string]: any }
    ): Promise<void>;

    protected abstract deleteNamespace(acRequest: AccessRequest, namespace: string): Promise<void>;

    protected abstract listNamespaces(acRequest: AccessRequest): Promise<IStorageVectorNamespace[]>;

    protected abstract namespaceExists(acRequest: AccessRequest, namespace: string): Promise<boolean>;

    protected abstract getNamespace(acRequest: AccessRequest, namespace: string): Promise<IStorageVectorNamespace>;

    public static constructNsName(teamId: string, name: string) {
        const joinedName = name.trim().replace(/\s/g, '_').toLowerCase();
        return `${teamId}_${joinedName}`;
    }

    public static parseNsName(nsName: string) {
        const parts = nsName.split('_');
        if (parts.length < 2) return null;
        return {
            teamId: parts[0],
            name: parts.slice(1).join('_'),
        };
    }
}
