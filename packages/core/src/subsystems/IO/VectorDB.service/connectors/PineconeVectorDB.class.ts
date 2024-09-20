//==[ SRE: S3Storage ]======================

import { IStorageRequest, StorageConnector } from '@sre/IO/Storage.service/StorageConnector';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, IACL, TAccessLevel, TAccessResult, TAccessRole } from '@sre/types/ACL.types';

import SmythRuntime from '@sre/Core/SmythRuntime.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IVectorDBRequest, VectorDBConnector } from '../VectorDBConnector';
import {
    IStorageVectorNamespace,
    IVectorDataSourceDto,
    PineconeConfig,
    QueryOptions,
    Source,
    StorageVectorNamespaceMetadata,
    VectorDBMetadata,
    VectorsResultData,
} from '@sre/types/VectorDB.types';
import { Pinecone } from '@pinecone-database/pinecone';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { OpenAIEmbeddings } from '@langchain/openai';
import { VectorsHelper } from '../Vectors.helper';
import { isUrl } from '@sre/utils/data.utils';
import { Logger } from '@sre/helpers/Log.helper';
import { NKVConnector } from '@sre/IO/NKV.service/NKVConnector';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { JSONContentHelper } from '@sre/helpers/JsonContent.helper';
import { CacheConnector } from '@sre/MemoryManager/Cache.service';

const console = Logger('Pinecone VectorDB');

export class PineconeVectorDB extends VectorDBConnector {
    public name = 'PineconeVectorDB';
    public id = 'pinecone';
    private client: Pinecone;
    private indexName: string;
    private redisCache: CacheConnector;
    private accountConnector: AccountConnector;
    private openaiApiKey: string;

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
        this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
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

        // save namespace for listing
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = VectorDBConnector.constructNsName(teamId, namespace);

        const acl = new ACL().addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
        await this.setACL(acRequest, preparedNs, acl);

        return new Promise<void>((resolve) => resolve());
    }

    @SecureConnector.AccessControl
    protected async namespaceExists(acRequest: AccessRequest, namespace: string): Promise<boolean> {
        throw new Error('Pinecone does not support namespace existence check');
    }

    @SecureConnector.AccessControl
    protected async getNamespace(acRequest: AccessRequest, namespace: string): Promise<any> {
        throw new Error('Pinecone does not support getting a namespace');
    }

    @SecureConnector.AccessControl
    protected async listNamespaces(acRequest: AccessRequest): Promise<any[]> {
        throw new Error('Pinecone does not support listing namespaces');
    }

    @SecureConnector.AccessControl
    protected async deleteNamespace(acRequest: AccessRequest, namespace: string): Promise<void> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
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
    }

    @SecureConnector.AccessControl
    protected async search(
        acRequest: AccessRequest,
        namespace: string,
        query: string | number[],
        options: QueryOptions = {}
    ): Promise<VectorsResultData> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);

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

        return results.matches.map((match) => ({
            id: match.id,
            values: match.values,
            metadata: match.metadata,
        }));
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
    protected getNsMetadata(acRequest: AccessRequest, namespace: string): Promise<StorageVectorNamespaceMetadata> {
        return Promise.resolve({
            indexName: this.indexName,
        });
    }

    private async setACL(acRequest: AccessRequest, namespace: string, acl: IACL): Promise<void> {
        await this.redisCache
            .user(AccessCandidate.clone(acRequest.candidate))
            .set(`vectorDB:pinecone:namespace:${namespace}:acl`, JSON.stringify(acl));
    }

    private async getACL(ac: AccessCandidate, namespace: string): Promise<ACL | null | undefined> {
        let aclRes = await this.redisCache.user(ac).get(`vectorDB:pinecone:namespace:${namespace}:acl`);
        const acl = JSONContentHelper.create(aclRes?.toString?.()).tryParse();
        return acl;
    }

    private async deleteACL(ac: AccessCandidate, namespace: string): Promise<void> {
        this.redisCache.user(AccessCandidate.clone(ac)).delete(`vectorDB:pinecone:namespace:${namespace}:acl`);
    }
}
