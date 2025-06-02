//==[ SRE: S3Storage ]======================
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, IACL, TAccessLevel } from '@sre/types/ACL.types';

//import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IVectorDBRequest, VectorDBConnector } from '../VectorDBConnector';
import {
    DatasourceDto,
    IStorageVectorDataSource,
    IStorageVectorNamespace,
    IVectorDataSourceDto,
    QueryOptions,
    Source,
    StorageVectorNamespaceMetadata,
    VectorsResultData,
} from '@sre/types/VectorDB.types';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { CacheConnector } from '@sre/MemoryManager/Cache.service/CacheConnector';
import { OAuthConfig, SmythConfigs } from '@sre/types/Security.types';
import axios, { AxiosError } from 'axios';
import { AxiosInstance } from 'axios';
import { getM2MToken } from '@sre/utils/oauth.utils';
import { jsonrepair } from 'jsonrepair';
import crypto from 'crypto';

const console = Logger('Smyth Managed VectorDB');

export class SmythManagedVectorDB extends VectorDBConnector {
    public name = 'SmythManagedVectorDB';
    public id = 'smyth-managed';
    private oAuthAppId: string;
    private oAuthAppSecret: string;
    private oAuthBaseUrl: string;
    private oAuthResource?: string;
    private oAuthScope?: string;
    private smythAPI: AxiosInstance;
    private accountConnector: AccountConnector;
    private redisCache: CacheConnector;
    private openaiApiKey: string;

    private isCustomStorageInstance: boolean;

    constructor(private config: SmythConfigs & OAuthConfig & { openaiApiKey?: string; isCustomStorageInstance?: boolean }) {
        super();
        //if (!SmythRuntime.Instance) throw new Error('SRE not initialized');
        this.oAuthAppId = config.oAuthAppID;
        this.oAuthAppSecret = config.oAuthAppSecret;
        this.oAuthBaseUrl = config.oAuthBaseUrl;
        this.oAuthResource = config.oAuthResource || '';
        this.oAuthScope = config.oAuthScope || '';
        this.smythAPI = axios.create({
            baseURL: `${config.smythAPIBaseUrl}`,
        });
        this.accountConnector = ConnectorService.getAccountConnector();
        this.redisCache = ConnectorService.getCacheConnector('Redis');
        this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
        this.isCustomStorageInstance = config.isCustomStorageInstance || false;
    }

    @SecureConnector.AccessControl
    protected async createDatasource(
        acRequest: AccessRequest,
        namespace: string,
        datasource: DatasourceDto,
    ): Promise<{ id: string; vectorIds: string[] }> {
        try {
            const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
            const preparedNs = VectorDBConnector.constructNsName(teamId, namespace);
            const res = await this.smythAPI.post<{ dataSourceId: string }>(
                '/v1/vectors/datasources/text',
                {
                    id: datasource.id || crypto.randomUUID(),
                    name: datasource.label || 'Indexer Datasource',
                    text: datasource.text,
                    namespaceId: preparedNs,
                    metadata: datasource.metadata ? JSON.stringify(datasource.metadata) : null,
                    teamId,
                },
                { headers: await this.getSmythRequestHeaders() },
            );

            return {
                id: res.data.dataSourceId,
                vectorIds: [],
            };
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
            throw new Error('Failed to create datasource with error: ' + errorMessage);
        }
    }

    @SecureConnector.AccessControl
    protected async deleteDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<void> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = VectorDBConnector.constructNsName(teamId, namespace);

        try {
            await this.smythAPI.delete(`/v1/vectors/datasources/${datasourceId}`, {
                headers: await this.getSmythRequestHeaders(),
            });
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
            throw new Error('Failed to delete datasource with error: ' + errorMessage);
        }
    }

    @SecureConnector.AccessControl
    protected async listDatasources(acRequest: AccessRequest, namespace: string): Promise<{ id: string; data: IStorageVectorDataSource }[]> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = VectorDBConnector.constructNsName(teamId, namespace);
        try {
            const res = await this.smythAPI.get<{ datasources: any[] }>(`/v1/vectors/datasources?namespaceId=${preparedNs}`, {
                headers: await this.getSmythRequestHeaders(),
            });
            return res.data.datasources.map((d) => {
                return {
                    id: d.id,
                    data: {
                        name: d.name,
                        namespaceId: d.namespaceId,
                        teamId,
                        embeddingIds: null,
                        text: null,
                        metadata: JSON.stringify({}),
                    },
                };
            });
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
            throw new Error('Failed to list datasources with error: ' + errorMessage);
        }
    }

    @SecureConnector.AccessControl
    protected async getDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<IStorageVectorDataSource> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = VectorDBConnector.constructNsName(teamId, namespace);
        try {
            const res = await this.smythAPI
                .get<{ dataSource: any }>(`/v1/vectors/datasources/${datasourceId}`, {
                    headers: await this.getSmythRequestHeaders(),
                })
                .catch((e: AxiosError) => {
                    if (e.response?.status === 404) {
                        return undefined; // not found
                    }
                    throw e;
                });
            const ds = res?.data?.dataSource;
            return ds
                ? {
                      name: ds.name,
                      embeddingIds: null,
                      metadata: JSON.stringify({}),
                      namespaceId: ds.namespaceId,
                      teamId,
                      text: null,
                  }
                : undefined;
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
            throw new Error('Failed to get datasource with error: ' + errorMessage);
        }
    }

    @SecureConnector.AccessControl
    protected async createNamespace(acRequest: AccessRequest, namespace: string, metadata?: { [key: string]: any }): Promise<void> {
        // save namespace for listing
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);

        try {
            const res = await this.smythAPI.post(
                '/v1/vectors/namespaces',
                {
                    name: namespace,
                    teamId,
                    useCustomVectorStorage: this.isCustomStorageInstance,
                },
                { headers: await this.getSmythRequestHeaders() },
            );
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
            throw new Error('Failed to create namespace with error: ' + errorMessage);
        }

        return new Promise<void>((resolve) => resolve());
    }

    @SecureConnector.AccessControl
    protected async namespaceExists(acRequest: AccessRequest, namespace: string): Promise<boolean> {
        const namespaceRecord = await this.getNamespace(acRequest, namespace);
        return !!namespaceRecord;
    }

    @SecureConnector.AccessControl
    protected async getNamespace(acRequest: AccessRequest, namespace: string): Promise<IStorageVectorNamespace> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);

        const preparedNs = VectorDBConnector.constructNsName(teamId, namespace);
        try {
            const res = await this.smythAPI
                .get<{ namespace: any }>(`/v1/vectors/namespaces/${preparedNs}`, {
                    headers: await this.getSmythRequestHeaders(),
                })
                .catch((e: AxiosError) => {
                    if (e.response.status === 404) {
                        return undefined; // not found
                    }
                    throw e;
                });
            const namespaceRecord = res?.data?.namespace;
            if (!namespaceRecord) return undefined;
            return {
                displayName: namespaceRecord.name,
                teamId,
                namespace: namespaceRecord.id,
                metadata: {
                    indexName: namespaceRecord.indexName,
                    isOnCustomStorage: namespaceRecord.isOnCustomStorage,
                },
            };
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
            throw new Error('Failed to get namespace with error: ' + errorMessage);
        }
    }

    protected async listNamespaces(acRequest: AccessRequest): Promise<IStorageVectorNamespace[]> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        try {
            const response = await this.smythAPI.get<{
                namespaces: {
                    name: string;
                    createdAt: string;
                    id: string;
                    isOnCustomStorage: boolean;
                    indexName?: string;
                }[];
            }>(`/v1/vectors/namespaces?teamId=${teamId}`, { headers: await this.getSmythRequestHeaders() });

            return response.data.namespaces.map((n) => {
                return {
                    displayName: n.name,
                    namespace: n.id,
                    metadata: {
                        indexName: n.indexName,
                        isOnCustomStorage: n.isOnCustomStorage,
                    },
                    teamId,
                };
            });
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
            throw new Error('Failed to list namespaces with error: ' + errorMessage);
        }
    }

    @SecureConnector.AccessControl
    protected async deleteNamespace(acRequest: AccessRequest, namespace: string): Promise<void> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = VectorDBConnector.constructNsName(teamId, namespace);

        try {
            const response = await this.smythAPI.delete(`/v1/vectors/namespaces/${preparedNs}`, { headers: await this.getSmythRequestHeaders() });
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
            throw new Error('Failed to delete namespace with error: ' + errorMessage);
        }
    }

    @SecureConnector.AccessControl
    protected async search(
        acRequest: AccessRequest,
        namespace: string,
        query: string | number[],
        options: QueryOptions = {},
    ): Promise<VectorsResultData> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = VectorDBConnector.constructNsName(teamId, namespace);
        if (typeof query !== 'string') {
            throw new Error('Smyth Managed VectorDB only supports string queries');
        }

        try {
            const response = await this.smythAPI.get<{ results: { pageContent: string; metadata: any }[] }>(
                `/v1/vectors/namespaces/search?query=${query}&topK=${options?.topK}&namespaceId=${preparedNs}&raw=true`,
                { headers: await this.getSmythRequestHeaders() },
            );

            return response.data.results.map((result) => {
                let userMetadata = {};
                try {
                    userMetadata = JSON.parse(jsonrepair(result.metadata?.metadata));
                } catch (err) {
                    userMetadata = result.metadata?.metadata;
                }
                return {
                    id: null,
                    values: [],
                    metadata: {
                        text: result.pageContent,
                        user: userMetadata,
                    },
                };
            });
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
            throw new Error('Failed to search with error: ' + errorMessage);
        }
    }

    @SecureConnector.AccessControl
    protected async insert(
        acRequest: AccessRequest,
        namespace: string,
        sourceWrapper: IVectorDataSourceDto | IVectorDataSourceDto[],
    ): Promise<string[]> {
        throw new Error('Smyth Managed VectorDB does not support direct insertion by vector id(s)');
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, namespace: string, id: string | string[]): Promise<void> {
        throw new Error('Smyth Managed VectorDB does not support direct deletion by vector id(s)');
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        const teamId = await this.accountConnector.getCandidateTeam(AccessCandidate.clone(candidate));
        const preparedNs = VectorDBConnector.constructNsName(teamId, resourceId);
        const nsRecord = await this.smythAPI
            .get(`/v1/vectors/namespaces/${preparedNs}`, { headers: await this.getSmythRequestHeaders() })
            .catch((e: AxiosError) => {
                if (e.response?.status === 404) {
                    return null; // not found
                }
                throw e;
            });
        const exists = !!nsRecord;

        if (!exists) {
            //the resource does not exist yet, we grant write access to the candidate in order to allow the resource creation
            return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
        }
        return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
    }

    private async getSmythRequestHeaders() {
        return {
            Authorization: `Bearer ${await getM2MToken({
                baseUrl: this.oAuthBaseUrl,
                oauthAppId: this.oAuthAppId,
                oauthAppSecret: this.oAuthAppSecret,
                resource: this.oAuthResource,
                scope: this.oAuthScope,
            })}`,
        };
    }
}
