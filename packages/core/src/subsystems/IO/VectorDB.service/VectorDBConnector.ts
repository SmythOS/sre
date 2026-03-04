import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, TAccessRole } from '@sre/types/ACL.types';
import {
    DatasourceDto,
    IStorageVectorDataSource,
    IVectorDataSourceDto,
    QueryOptions,
    VectorDBResult,
    VectorsResultData,
} from '@sre/types/VectorDB.types';

export type DeleteFilterOptions = {
    datasourceId?: string;
};

export type DeleteTarget = string | string[] | DeleteFilterOptions;

export interface IVectorDBRequest {
    search(namespace: string, query: string | number[], options?: QueryOptions): Promise<VectorDBResult[]>;
    // insert(namespace: string, source: IVectorDataSourceDto | IVectorDataSourceDto[]): Promise<string[]>;
    // delete(namespace: string, id: string | string[]): Promise<void>;

    createDatasource(namespace: string, datasource: DatasourceDto): Promise<IStorageVectorDataSource>;
    deleteDatasource(namespace: string, datasourceId: string): Promise<void>;
    listDatasources(namespace: string): Promise<IStorageVectorDataSource[]>;
    getDatasource(namespace: string, datasourceId: string): Promise<IStorageVectorDataSource>;

    createNamespace(namespace: string, metadata?: { [key: string]: any }): Promise<void>;
    deleteNamespace(namespace: string): Promise<void>;
    namespaceExists(namespace: string): Promise<boolean>;
}

export abstract class VectorDBConnector extends SecureConnector<IVectorDBRequest> {
    protected readonly USER_METADATA_KEY = 'user_metadata';
    protected readonly LEGACY_USER_METADATA_KEY = 'metadata';

    public abstract id: string;
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;

    public requester(candidate: AccessCandidate): IVectorDBRequest {
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
            namespaceExists: async (namespace: string) => {
                return await this.namespaceExists(candidate.readRequest, namespace);
            },
        };
    }

    protected abstract search(
        acRequest: AccessRequest,
        namespace: string,
        query: string | number[],
        options: QueryOptions
    ): Promise<VectorDBResult[]>;

    protected abstract insert(
        acRequest: AccessRequest,
        namespace: string,
        source: IVectorDataSourceDto | IVectorDataSourceDto[]
    ): Promise<VectorDBResult[]>;

    protected abstract delete(acRequest: AccessRequest, namespace: string, deleteTarget: DeleteTarget): Promise<void>;

    protected abstract createDatasource(acRequest: AccessRequest, namespace: string, datasource: DatasourceDto): Promise<IStorageVectorDataSource>;

    protected abstract deleteDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<void>;

    protected abstract listDatasources(acRequest: AccessRequest, namespace: string): Promise<IStorageVectorDataSource[]>;

    protected abstract getDatasource(
        acRequest: AccessRequest,
        namespace: string,
        datasourceId: string
    ): Promise<IStorageVectorDataSource | undefined>;

    protected abstract createNamespace(
        acRequest: AccessRequest,
        namespace: string,

        metadata?: { [key: string]: any }
    ): Promise<void>;

    protected abstract deleteNamespace(acRequest: AccessRequest, namespace: string): Promise<void>;

    protected abstract namespaceExists(acRequest: AccessRequest, namespace: string): Promise<boolean>;

    public constructNsName(candidate: AccessCandidate, name: string) {
        //normalise name
        const joinedName = name.trim().replace(/\s/g, '_').toLowerCase();
        //add prefix = first letter of role + id
        let prefix = candidate.role[0] + '_' + candidate.id;

        return `${prefix}_${joinedName}`;
    }
}
