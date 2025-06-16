//==[ SRE: S3Storage ]======================
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, IACL, TAccessLevel } from '@sre/types/ACL.types';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { VectorDBConnector } from '../VectorDBConnector';
import {
    DatasourceDto,
    IStorageVectorDataSource,
    IStorageVectorNamespace,
    IVectorDataSourceDto,
    QueryOptions,
    VectorsResultData,
} from '@sre/types/VectorDB.types';
import { Pinecone } from '@pinecone-database/pinecone';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { NKVConnector } from '@sre/IO/NKV.service/NKVConnector';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { JSONContentHelper } from '@sre/helpers/JsonContent.helper';
import { CacheConnector } from '@sre/MemoryManager/Cache.service/CacheConnector';
import crypto from 'crypto';
import { BaseEmbedding, TEmbeddings } from '../embed/BaseEmbedding';
import { EmbeddingsFactory, SupportedProviders, SupportedModels } from '../embed';
import { chunkText } from '@sre/utils/string.utils';
import { jsonrepair } from 'jsonrepair';

const console = Logger('Pinecone VectorDB');

export type PineconeConfig = {
    pineconeApiKey: string;
    indexName: string;
    embeddings: TEmbeddings;
};
export class PineconeVectorDB extends VectorDBConnector {
    public name = 'PineconeVectorDB';
    public id = 'pinecone';
    private client: Pinecone;
    private indexName: string;
    private cache: CacheConnector;
    private accountConnector: AccountConnector;
    private nkvConnector: NKVConnector;
    public embedder: BaseEmbedding;

    constructor(protected _settings: PineconeConfig) {
        super(_settings);
        if (!_settings.pineconeApiKey) {
            console.warn('Missing Pinecone API key : returning empty Pinecone connector');
            return;
        }
        if (!_settings.indexName) {
            console.warn('Missing Pinecone index name : returning empty Pinecone connector');
            return;
        }

        this.client = new Pinecone({
            apiKey: _settings.pineconeApiKey,
        });
        console.info('Pinecone client initialized');
        console.info('Pinecone index name:', _settings.indexName);
        this.indexName = _settings.indexName;
        this.accountConnector = ConnectorService.getAccountConnector();
        this.cache = ConnectorService.getCacheConnector();
        this.nkvConnector = ConnectorService.getNKVConnector();
        if (!_settings.embeddings.dimensions) _settings.embeddings.dimensions = 1024;

        this.embedder = EmbeddingsFactory.create(_settings.embeddings.provider, _settings.embeddings);
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        //const teamId = await this.accountConnector.getCandidateTeam(AccessCandidate.clone(candidate));
        const preparedNs = VectorDBConnector.constructNsName(candidate as AccessCandidate, resourceId);
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
        //* Since Pinecone does not create explicit namespaces,
        //*  we create a zero or dummy vector in the namespace to trigger the namespace creation and filter it out

        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = VectorDBConnector.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        const acl = new ACL().addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner);

        const nsData = {
            acl: acl.serializedACL,
            displayName: namespace,
            ...metadata,
        };
        await this.client
            .Index(this.indexName)
            .namespace(preparedNs)
            .upsert([
                {
                    id: `_reserved_${preparedNs}`,
                    values: this.embedder.dummyVector,
                    metadata: {
                        isSkeletonVector: true,
                        ...nsData,
                    },
                },
            ]);

        await this.setACL(acRequest, preparedNs, acl.ACL);

        return new Promise<void>((resolve) => resolve());
    }

    @SecureConnector.AccessControl
    protected async namespaceExists(acRequest: AccessRequest, namespace: string): Promise<boolean> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const stats = await this.client.Index(this.indexName).describeIndexStats();
        return Object.keys(stats.namespaces).includes(VectorDBConnector.constructNsName(acRequest.candidate as AccessCandidate, namespace));
    }

    @SecureConnector.AccessControl
    protected async deleteNamespace(acRequest: AccessRequest, namespace: string): Promise<void> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        //const candidate = AccessCandidate.team(teamId);
        const preparedNs = VectorDBConnector.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        await this.client
            .Index(this.indexName)
            .namespace(VectorDBConnector.constructNsName(acRequest.candidate as AccessCandidate, namespace))
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
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);

        const pineconeIndex = this.client
            .Index(this.indexName)
            .namespace(VectorDBConnector.constructNsName(acRequest.candidate as AccessCandidate, namespace));
        let _vector = query;
        if (typeof query === 'string') {
            _vector = await this.embedder.embedText(query, acRequest.candidate as AccessCandidate);
        }

        const topK = (options.topK || 10) + 1; //* we increment one in case it included the skeleton vector

        const results = await pineconeIndex.query({
            topK,
            vector: _vector as number[],
            includeMetadata: true,
            includeValues: true,
        });

        let matches: VectorsResultData = [];

        for (const match of results.matches) {
            if (match.metadata?.isSkeletonVector) continue;

            if (match.metadata?.user) {
                match.metadata.user = JSONContentHelper.create(match.metadata.user.toString()).tryParse();
            }
            matches.push({
                id: match.id,
                values: match.values,
                metadata: match.metadata,
            });
        }

        // in the case where we did not filter out the skeleton vector, we need to remove the extra match from the results
        return matches.slice(0, options.topK);
    }

    @SecureConnector.AccessControl
    protected async insert(
        acRequest: AccessRequest,
        namespace: string,
        sourceWrapper: IVectorDataSourceDto | IVectorDataSourceDto[]
    ): Promise<string[]> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        sourceWrapper = Array.isArray(sourceWrapper) ? sourceWrapper : [sourceWrapper];

        // make sure that all sources are of the same type (source.source)
        if (sourceWrapper.some((s) => this.embedder.detectSourceType(s.source) !== this.embedder.detectSourceType(sourceWrapper[0].source))) {
            throw new Error('All sources must be of the same type');
        }

        const sourceType = this.embedder.detectSourceType(sourceWrapper[0].source);
        if (sourceType === 'unknown' || sourceType === 'url') throw new Error('Invalid source type');
        const transformedSource = await this.embedder.transformSource(sourceWrapper, sourceType, acRequest.candidate as AccessCandidate);
        const preparedSource = transformedSource.map((s) => ({
            id: s.id,
            values: s.source as number[],
            metadata: s.metadata,
        }));

        // await pineconeStore.addDocuments(chunks, ids);
        await this.client
            .Index(this.indexName)
            .namespace(VectorDBConnector.constructNsName(acRequest.candidate as AccessCandidate, namespace))
            .upsert(preparedSource);

        const accessCandidate = acRequest.candidate;

        const isNewNs = !(await this.user(AccessCandidate.clone(accessCandidate)).namespaceExists(namespace));
        if (isNewNs) {
            let acl = new ACL().addAccess(accessCandidate.role, accessCandidate.id, TAccessLevel.Owner).ACL;
            await this.setACL(acRequest, namespace, acl);
        }

        return preparedSource.map((s) => s.id);
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, namespace: string, id: string | string[]): Promise<void> {
        const _ids = Array.isArray(id) ? id : [id];
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);

        const res = await this.client
            .Index(this.indexName)
            .namespace(VectorDBConnector.constructNsName(acRequest.candidate as AccessCandidate, namespace))
            .deleteMany(_ids);
    }

    @SecureConnector.AccessControl
    protected async createDatasource(acRequest: AccessRequest, namespace: string, datasource: DatasourceDto): Promise<IStorageVectorDataSource> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const acl = new ACL().addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner);
        const dsId = datasource.id || crypto.randomUUID();

        const formattedNs = VectorDBConnector.constructNsName(acRequest.candidate as AccessCandidate, namespace);
        const chunkedText = chunkText(datasource.text, {
            chunkSize: datasource.chunkSize,
            chunkOverlap: datasource.chunkOverlap,
        });
        const ids = Array.from({ length: chunkedText.length }, (_, i) => `${dsId}_${crypto.randomUUID()}`);
        const source: IVectorDataSourceDto[] = chunkedText.map((doc, i) => {
            return {
                id: ids[i],
                source: doc,
                metadata: {
                    acl: acl.serializedACL,
                    namespaceId: formattedNs,
                    datasourceId: dsId,
                    user: datasource.metadata ? jsonrepair(JSON.stringify(datasource.metadata)) : undefined,
                },
            };
        });

        const _vIds = await this.insert(acRequest, namespace, source);

        const dsData: IStorageVectorDataSource = {
            namespaceId: formattedNs,
            candidateId: acRequest.candidate.id,
            candidateRole: acRequest.candidate.role,
            name: datasource.label || 'Untitled',
            metadata: datasource.metadata ? jsonrepair(JSON.stringify(datasource.metadata)) : undefined,
            text: datasource.text,
            vectorIds: _vIds,
            id: dsId,
        };
        // const url = `smythfs://${teamId}.team/_datasources/${dsId}.json`;
        // await SmythFS.Instance.write(url, JSON.stringify(dsData), AccessCandidate.team(teamId));
        await this.nkvConnector
            .user(acRequest.candidate as AccessCandidate)
            .set(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`, dsId, JSON.stringify(dsData));
        // return { id: dsId, vectorIds: _vIds };
        return dsData;
    }

    @SecureConnector.AccessControl
    protected async deleteDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<void> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = VectorDBConnector.constructNsName(acRequest.candidate as AccessCandidate, namespace);
        // const url = `smythfs://${teamId}.team/_datasources/${dsId}.json`;
        // await SmythFS.Instance.delete(url, AccessCandidate.team(teamId));
        let ds: IStorageVectorDataSource = JSONContentHelper.create(
            (
                await this.nkvConnector
                    .user(acRequest.candidate as AccessCandidate)
                    .get(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`, datasourceId)
            )?.toString()
        ).tryParse();

        if (!ds || typeof ds !== 'object') {
            throw new Error(`Data source not found with id: ${datasourceId}`);
        }

        await this.delete(acRequest, namespace, ds.vectorIds || []);

        await this.nkvConnector
            .user(acRequest.candidate as AccessCandidate)
            .delete(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`, datasourceId);
    }

    @SecureConnector.AccessControl
    protected async listDatasources(acRequest: AccessRequest, namespace: string): Promise<IStorageVectorDataSource[]> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = VectorDBConnector.constructNsName(acRequest.candidate as AccessCandidate, namespace);
        return (
            await this.nkvConnector.user(acRequest.candidate as AccessCandidate).list(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`)
        ).map((ds) => {
            return JSONContentHelper.create(ds.data?.toString()).tryParse() as IStorageVectorDataSource;
        });
    }

    @SecureConnector.AccessControl
    protected async getDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<IStorageVectorDataSource> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = VectorDBConnector.constructNsName(acRequest.candidate as AccessCandidate, namespace);
        return JSONContentHelper.create(
            (
                await this.nkvConnector
                    .user(acRequest.candidate as AccessCandidate)
                    .get(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`, datasourceId)
            )?.toString()
        ).tryParse() as IStorageVectorDataSource;
    }

    private async setACL(acRequest: AccessRequest, preparedNs: string, acl: IACL): Promise<void> {
        await this.cache.user(AccessCandidate.clone(acRequest.candidate)).set(`vectorDB:pinecone:namespace:${preparedNs}:acl`, JSON.stringify(acl));
    }

    private async getACL(ac: AccessCandidate, preparedNs: string): Promise<ACL | null | undefined> {
        let aclRes = await this.cache.user(ac).get(`vectorDB:pinecone:namespace:${preparedNs}:acl`);
        const acl = JSONContentHelper.create(aclRes?.toString?.()).tryParse();
        return acl;
    }

    private async deleteACL(ac: AccessCandidate, preparedNs: string): Promise<void> {
        this.cache.user(AccessCandidate.clone(ac)).delete(`vectorDB:pinecone:namespace:${preparedNs}:acl`);
    }
}
