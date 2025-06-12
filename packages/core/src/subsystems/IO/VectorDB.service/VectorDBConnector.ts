import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate } from '@sre/types/ACL.types';
import {
    DatasourceDto,
    IStorageVectorDataSource,
    IStorageVectorNamespace,
    IVectorDataSourceDto,
    QueryOptions,
    VectorsResultData,
} from '@sre/types/VectorDB.types';
import { OpenAIEmbeds } from './embed/OpenAIEmbedding';

const embedders = {
    OpenAI: OpenAIEmbeds,
};

export interface IVectorDBRequest {
    search(namespace: string, query: string | number[], options?: QueryOptions): Promise<VectorsResultData>;
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
        options: QueryOptions,
    ): Promise<VectorsResultData>;

    protected abstract insert(acRequest: AccessRequest, namespace: string, source: IVectorDataSourceDto | IVectorDataSourceDto[]): Promise<string[]>;

    protected abstract delete(acRequest: AccessRequest, namespace: string, id: string | string[]): Promise<void>;

    protected abstract createDatasource(acRequest: AccessRequest, namespace: string, datasource: DatasourceDto): Promise<IStorageVectorDataSource>;

    protected abstract deleteDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<void>;

    protected abstract listDatasources(acRequest: AccessRequest, namespace: string): Promise<IStorageVectorDataSource[]>;

    protected abstract getDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<IStorageVectorDataSource>;

    protected abstract createNamespace(
        acRequest: AccessRequest,
        namespace: string,

        metadata?: { [key: string]: any },
    ): Promise<void>;

    protected abstract deleteNamespace(acRequest: AccessRequest, namespace: string): Promise<void>;

    protected abstract namespaceExists(acRequest: AccessRequest, namespace: string): Promise<boolean>;

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
