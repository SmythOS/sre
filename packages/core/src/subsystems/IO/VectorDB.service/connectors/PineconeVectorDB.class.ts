//==[ SRE: S3Storage ]======================

import { IStorageRequest, StorageConnector } from '@sre/IO/Storage.service/StorageConnector';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, IACL, TAccessLevel, TAccessResult, TAccessRole } from '@sre/types/ACL.types';

import SmythRuntime from '@sre/Core/SmythRuntime.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { VectorDBConnector } from '../VectorDBConnector';
import {
    DatasourceDto,
    IStorageVectorDataSource,
    IStorageVectorNamespace,
    IVectorDataSourceDto,
    PineconeConfig,
    QueryOptions,
    StorageVectorNamespaceMetadata,
    VectorsResultData,
} from '@sre/types/VectorDB.types';
import { Pinecone } from '@pinecone-database/pinecone';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { VectorsHelper } from '../Vectors.helper';
import { Logger } from '@sre/helpers/Log.helper';
import { NKVConnector } from '@sre/IO/NKV.service/NKVConnector';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { JSONContentHelper } from '@sre/helpers/JsonContent.helper';
import { CacheConnector } from '@sre/MemoryManager/Cache.service';
import crypto from 'crypto';

const console = Logger('Pinecone VectorDB');

export class PineconeVectorDB extends VectorDBConnector {
    public name = 'PineconeVectorDB';
    public id = 'pinecone';
    private client: Pinecone;
    private indexName: string;
    private redisCache: CacheConnector;
    private accountConnector: AccountConnector;
    private openaiApiKey: string;
    private nkvConnector: NKVConnector;
    private isCustomStorageInstance: boolean;
    private helper: VectorsHelper;

    constructor(config: PineconeConfig) {
        super();
        if (!SmythRuntime.Instance) throw new Error('SRE not initialized');
        if (!config.pineconeApiKey) throw new Error('Pinecone API key is required');
        if (!config.indexName) throw new Error('Pinecone index name is required');

        this.client = new Pinecone({
            apiKey: config.pineconeApiKey,
        });
        console.info('Pinecone client initialized');
        console.info('Pinecone index name:', config.indexName);
        this.indexName = config.indexName;
        this.accountConnector = ConnectorService.getAccountConnector();
        this.redisCache = ConnectorService.getCacheConnector('Redis');
        this.nkvConnector = ConnectorService.getNKVConnector();
        this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
        this.helper = VectorsHelper.load({ openaiApiKey: this.openaiApiKey });
        this.isCustomStorageInstance = config.isCustomStorageInstance || false;
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        const teamId = await this.accountConnector.getCandidateTeam(AccessCandidate.clone(candidate));
        const preparedNs = VectorDBConnector.constructNsName(teamId, resourceId);
        const acl = await this.getACL(AccessCandidate.clone(candidate), preparedNs);
        const exists = !!acl;

        if (!exists) {
            //the resource does not exist yet, we grant write access to the candidate in order to allow the resource creation
            return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
        }
        return ACL.from(acl);
    }

    @SecureConnector.AccessControl
    protected async createNamespace(acRequest: AccessRequest, namespace: string, metadata?: { [key: string]: any }): Promise<void> {
        //* Pinecone does not need explicit namespace creation, instead, it creates the namespace when the first vector is inserted
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = VectorDBConnector.constructNsName(teamId, namespace);

        const candidate = AccessCandidate.team(teamId);
        const nsExists = await this.nkvConnector.user(candidate).exists(`vectorDB:${this.id}`, `namespace:${preparedNs}`);

        if (!nsExists) {
            const nsData: IStorageVectorNamespace = {
                namespace: preparedNs,
                displayName: namespace,
                teamId,
                metadata: {
                    ...metadata,
                    isOnCustomStorage: this.isCustomStorageInstance,
                    indexName: this.indexName,
                },
            };
            await this.nkvConnector.user(candidate).set(`vectorDB:${this.id}:namespaces`, preparedNs, JSON.stringify(nsData));
        }

        const acl = new ACL().addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
        await this.setACL(acRequest, preparedNs, acl);

        return new Promise<void>((resolve) => resolve());
    }

    @SecureConnector.AccessControl
    protected async namespaceExists(acRequest: AccessRequest, namespace: string): Promise<boolean> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        return await this.nkvConnector
            .user(AccessCandidate.team(teamId))
            .exists(`vectorDB:${this.id}:namespaces`, VectorDBConnector.constructNsName(teamId, namespace));
    }

    @SecureConnector.AccessControl
    protected async getNamespace(acRequest: AccessRequest, namespace: string): Promise<any> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = VectorDBConnector.constructNsName(teamId, namespace);
        const nsData = await this.nkvConnector.user(AccessCandidate.team(teamId)).get(`vectorDB:${this.id}:namespaces`, preparedNs);
        return JSONContentHelper.create(nsData?.toString()).tryParse() as IStorageVectorNamespace;
    }

    @SecureConnector.AccessControl
    protected async listNamespaces(acRequest: AccessRequest): Promise<any[]> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const candidate = AccessCandidate.team(teamId);
        const nsKeys = await this.nkvConnector.user(candidate).list(`vectorDB:${this.id}:namespaces`);
        return nsKeys.map((k) => JSONContentHelper.create(k.data?.toString()).tryParse() as IStorageVectorNamespace);
    }

    @SecureConnector.AccessControl
    protected async deleteNamespace(acRequest: AccessRequest, namespace: string): Promise<void> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const candidate = AccessCandidate.team(teamId);
        const preparedNs = VectorDBConnector.constructNsName(teamId, namespace);

        await this.client
            .Index(this.indexName)
            .namespace(VectorDBConnector.constructNsName(teamId, namespace))
            .deleteAll()
            .catch((e) => {
                if (e?.name == 'PineconeNotFoundError') {
                    console.warn(`Namespace ${namespace} does not exist and was requested to be deleted`);
                    return;
                }
                throw e;
            });

        await this.deleteACL(AccessCandidate.clone(acRequest.candidate), namespace);

        await this.nkvConnector.user(candidate).delete('vectorDB:pinecone:namespaces', preparedNs);
    }

    @SecureConnector.AccessControl
    protected async search(
        acRequest: AccessRequest,
        namespace: string,
        query: string | number[],
        options: QueryOptions = {}
    ): Promise<VectorsResultData> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        let ns = await this.nkvConnector
            .user(AccessCandidate.team(teamId))
            .get(`vectorDB:${this.id}:namespaces`, VectorDBConnector.constructNsName(teamId, namespace));

        if (!ns) {
            throw new Error('Namespace does not exist');
        }

        const nsData = JSONContentHelper.create(ns.toString()).tryParse() as IStorageVectorNamespace;
        if (nsData.metadata?.isOnCustomStorage && !this.isCustomStorageInstance) {
            throw new Error('Tried to access namespace on custom storage.');
        } else if (!nsData.metadata?.isOnCustomStorage && this.isCustomStorageInstance) {
            throw new Error('Tried to access namespace that is not on custom storage.');
        }

        const pineconeIndex = this.client.Index(this.indexName).namespace(VectorDBConnector.constructNsName(teamId, namespace));
        let _vector = query;
        if (typeof query === 'string') {
            _vector = await VectorsHelper.load({ openaiApiKey: this.openaiApiKey }).embedText(query);
        }

        const results = await pineconeIndex.query({
            topK: options?.topK || 10,
            vector: _vector as number[],
            includeMetadata: true,
            includeValues: true,
        });

        return results.matches.map((match) => {
            if (match.metadata?.user) {
                match.metadata.user = VectorsHelper.parseMetadata(match.metadata.user);
            }
            return {
                id: match.id,
                values: match.values,
                metadata: match.metadata,
            };
        });
    }

    @SecureConnector.AccessControl
    protected async insert(
        acRequest: AccessRequest,
        namespace: string,
        sourceWrapper: IVectorDataSourceDto | IVectorDataSourceDto[]
    ): Promise<string[]> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        sourceWrapper = Array.isArray(sourceWrapper) ? sourceWrapper : [sourceWrapper];
        const helper = VectorsHelper.load({ openaiApiKey: this.openaiApiKey });

        // make sure that all sources are of the same type (source.source)
        if (sourceWrapper.some((s) => helper.detectSourceType(s.source) !== helper.detectSourceType(sourceWrapper[0].source))) {
            throw new Error('All sources must be of the same type');
        }

        const sourceType = helper.detectSourceType(sourceWrapper[0].source);
        if (sourceType === 'unknown' || sourceType === 'url') throw new Error('Invalid source type');
        const transformedSource = await helper.transformSource(sourceWrapper, sourceType);
        const preparedSource = transformedSource.map((s) => ({
            id: s.id,
            values: s.source as number[],
            metadata: s.metadata,
        }));

        // await pineconeStore.addDocuments(chunks, ids);
        await this.client.Index(this.indexName).namespace(VectorDBConnector.constructNsName(teamId, namespace)).upsert(preparedSource);

        const accessCandidate = acRequest.candidate;

        const isNewNs = await VectorsHelper.load({ openaiApiKey: this.openaiApiKey }).isNewNs(AccessCandidate.clone(accessCandidate), namespace);
        if (isNewNs) {
            let acl = new ACL().addAccess(accessCandidate.role, accessCandidate.id, TAccessLevel.Owner).ACL;
            await this.setACL(acRequest, namespace, acl);
        }

        return preparedSource.map((s) => s.id);
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, namespace: string, id: string | string[]): Promise<void> {
        const _ids = Array.isArray(id) ? id : [id];
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);

        const res = await this.client.Index(this.indexName).namespace(VectorDBConnector.constructNsName(teamId, namespace)).deleteMany(_ids);
    }

    @SecureConnector.AccessControl
    protected async createDatasource(
        acRequest: AccessRequest,
        namespace: string,
        datasource: DatasourceDto
    ): Promise<{ id: string; vectorIds: string[] }> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = VectorDBConnector.constructNsName(teamId, namespace);
        const chunkedText = await VectorsHelper.chunkText(datasource.text, {
            chunkSize: datasource.chunkSize,
            chunkOverlap: datasource.chunkOverlap,
        });
        const ids = Array.from({ length: chunkedText.length }, (_, i) => crypto.randomUUID());
        const source: IVectorDataSourceDto[] = chunkedText.map((doc, i) => {
            return {
                id: ids[i],
                source: doc,
                metadata: {
                    user: VectorsHelper.stringifyMetadata(datasource.metadata), // user-speficied metadata
                },
            };
        });
        const nsExists = await this.nkvConnector
            .user(AccessCandidate.team(teamId))
            .exists(`vectorDB:${this.id}:namespaces`, VectorDBConnector.constructNsName(teamId, namespace));
        if (!nsExists) {
            throw new Error('Namespace does not exist');
        }

        const _vIds = await this.insert(acRequest, namespace, source);

        const dsId = datasource.id || crypto.randomUUID();

        const dsData: IStorageVectorDataSource = {
            namespaceId: formattedNs,
            teamId,
            name: datasource.label || 'Untitled',
            metadata: VectorsHelper.stringifyMetadata(datasource.metadata),
            text: datasource.text,
            embeddingIds: _vIds,
        };
        // const url = `smythfs://${teamId}.team/_datasources/${dsId}.json`;
        // await SmythFS.Instance.write(url, JSON.stringify(dsData), AccessCandidate.team(teamId));
        await this.nkvConnector
            .user(AccessCandidate.team(teamId))
            .set(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`, dsId, JSON.stringify(dsData));
        return { id: dsId, vectorIds: _vIds };
    }

    @SecureConnector.AccessControl
    protected async deleteDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<void> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = VectorDBConnector.constructNsName(teamId, namespace);
        // const url = `smythfs://${teamId}.team/_datasources/${dsId}.json`;
        // await SmythFS.Instance.delete(url, AccessCandidate.team(teamId));
        let ds: IStorageVectorDataSource = JSONContentHelper.create(
            (
                await this.nkvConnector
                    .user(AccessCandidate.team(teamId))
                    .get(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`, datasourceId)
            )?.toString()
        ).tryParse();

        if (!ds || typeof ds !== 'object') {
            throw new Error(`Data source not found with id: ${datasourceId}`);
        }

        const nsExists = await this.nkvConnector
            .user(AccessCandidate.team(teamId))
            .exists(`vectorDB:${this.id}:namespaces`, VectorDBConnector.constructNsName(teamId, namespace));
        if (!nsExists) {
            throw new Error('Namespace does not exist');
        }

        await this.delete(acRequest, namespace, ds.embeddingIds || []);

        await this.nkvConnector.user(AccessCandidate.team(teamId)).delete(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`, datasourceId);
    }

    @SecureConnector.AccessControl
    protected async listDatasources(acRequest: AccessRequest, namespace: string): Promise<{ id: string; data: IStorageVectorDataSource }[]> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = VectorDBConnector.constructNsName(teamId, namespace);
        return (await this.nkvConnector.user(AccessCandidate.team(teamId)).list(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`)).map(
            (ds) => {
                return {
                    id: ds.key,
                    data: JSONContentHelper.create(ds.data?.toString()).tryParse() as IStorageVectorDataSource,
                };
            }
        );
    }

    @SecureConnector.AccessControl
    protected async getDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<IStorageVectorDataSource> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = VectorDBConnector.constructNsName(teamId, namespace);
        return JSONContentHelper.create(
            (
                await this.nkvConnector
                    .user(AccessCandidate.team(teamId))
                    .get(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`, datasourceId)
            )?.toString()
        ).tryParse() as IStorageVectorDataSource;
    }

    private async setACL(acRequest: AccessRequest, preparedNs: string, acl: IACL): Promise<void> {
        await this.redisCache
            .user(AccessCandidate.clone(acRequest.candidate))
            .set(`vectorDB:pinecone:namespace:${preparedNs}:acl`, JSON.stringify(acl));
    }

    private async getACL(ac: AccessCandidate, preparedNs: string): Promise<ACL | null | undefined> {
        let aclRes = await this.redisCache.user(ac).get(`vectorDB:pinecone:namespace:${preparedNs}:acl`);
        const acl = JSONContentHelper.create(aclRes?.toString?.()).tryParse();
        return acl;
    }

    private async deleteACL(ac: AccessCandidate, preparedNs: string): Promise<void> {
        this.redisCache.user(AccessCandidate.clone(ac)).delete(`vectorDB:pinecone:namespace:${preparedNs}:acl`);
    }
}
