//==[ SRE: S3Storage ]======================
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, IACL, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { VectorDBConnector, DeleteTarget } from '../VectorDBConnector';
import {
    DatasourceDto,
    IStorageVectorDataSource,
    IStorageVectorNamespace,
    IVectorDataSourceDto,
    QueryOptions,
    VectorDBResult,
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
import { calcSizeMb } from '@sre/utils/string.utils';
import { jsonrepair } from 'jsonrepair';
import { chunkArr } from '@sre/utils/array.utils';

const console = Logger('Pinecone VectorDB');

export type PineconeConfig = {
    /**
     * The Pinecone API key [LEGACY]
     */
    apiKey: string;
    /**
     * The Pinecone index name [LEGACY]
     */
    indexName: string;

    /**
     * The Pinecone credentials [New unified format]
     */
    credentials: {
        apiKey: string;
        indexName: string;
    };
    /**
     * The embeddings model to use
     */
    embeddings?: TEmbeddings;
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
        if (!_settings.apiKey && !_settings.credentials?.apiKey) {
            console.warn('Missing Pinecone API key : returning empty Pinecone connector');
            return;
        }
        if (!_settings.indexName && !_settings.credentials?.indexName) {
            console.warn('Missing Pinecone index name : returning empty Pinecone connector');
            return;
        }

        this.client = new Pinecone({
            apiKey: _settings.apiKey || _settings.credentials?.apiKey,
        });
        console.info('Pinecone client initialized');
        console.info('Pinecone index name:', _settings.indexName || _settings.credentials?.indexName);
        this.indexName = _settings.indexName || _settings.credentials?.indexName;
        this.accountConnector = ConnectorService.getAccountConnector();
        this.cache = ConnectorService.getCacheConnector();
        this.nkvConnector = ConnectorService.getNKVConnector();
        if (!_settings.embeddings) {
            _settings.embeddings = { provider: 'OpenAI', model: 'text-embedding-3-large', dimensions: 3072 };
        }
        if (!_settings.embeddings?.dimensions) _settings.embeddings.dimensions = 3072;

        this.embedder = EmbeddingsFactory.create(_settings.embeddings.provider, _settings.embeddings);
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        //const teamId = await this.accountConnector.getCandidateTeam(AccessCandidate.clone(candidate));
        const preparedNs = this.constructNsName(candidate as AccessCandidate, resourceId);
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
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

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
        return Object.keys(stats.namespaces).includes(this.constructNsName(acRequest.candidate as AccessCandidate, namespace));
    }

    @SecureConnector.AccessControl
    protected async deleteNamespace(acRequest: AccessRequest, namespace: string): Promise<void> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        //const candidate = AccessCandidate.team(teamId);

        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        await this.client
            .Index(this.indexName)
            .namespace(this.constructNsName(acRequest.candidate as AccessCandidate, namespace))
            .deleteAll()
            .catch((e) => {
                console.error(`Error deleting namespace ${namespace}: ${e}`);
                if (e?.name == 'PineconeNotFoundError') {
                    console.warn(`Namespace ${namespace} does not exist and was requested to be deleted`);
                    return;
                }
                throw e;
            });

        // delete the linked datasources from nkv
        await this.nkvConnector
            .requester(acRequest.candidate as AccessCandidate)
            .deleteAll(`vectorDB:${this.id}:namespaces:${preparedNs}:datasources`);

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

        const pineconeIndex = this.client.Index(this.indexName).namespace(this.constructNsName(acRequest.candidate as AccessCandidate, namespace));
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

        let matches = [];

        for (const match of results.matches) {
            if (match.metadata?.isSkeletonVector) continue;

            if (match.metadata?.[this.USER_METADATA_KEY]) {
                match.metadata[this.USER_METADATA_KEY] = JSONContentHelper.create(match.metadata[this.USER_METADATA_KEY].toString()).tryParse();
            }

            const text = match.metadata?.text as string | undefined;
            delete match.metadata?.text; // delete the text metadata to avoid duplication in case we returned the default raw metadata

            matches.push({
                id: match.id,
                values: match.values,
                text: text,
                metadata: match.metadata?.[this.USER_METADATA_KEY] || match.metadata, // fallback to the default metadata if the user metadata is not present, this is for backward compatibility
                score: match.score,
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
    ): Promise<VectorDBResult[]> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        sourceWrapper = Array.isArray(sourceWrapper) ? sourceWrapper : [sourceWrapper];

        // make sure that all sources are of the same type (source.source)
        if (sourceWrapper.some((s) => this.embedder.detectSourceType(s.source) !== this.embedder.detectSourceType(sourceWrapper[0].source))) {
            throw new Error('All sources must be of the same type');
        }

        const sourceType = this.embedder.detectSourceType(sourceWrapper[0].source);
        if (sourceType === 'unknown' || sourceType === 'url') throw new Error('Invalid source type');
        const transformedSource = await this.embedder.transformSource(sourceWrapper, sourceType, acRequest.candidate as AccessCandidate);
        const preparedSources = transformedSource.map((s) => ({
            id: s.id,
            values: s.source as number[],
            metadata: s.metadata,
        }));

        // pinecone advices to use batches of 100 at a time
        const batchSize = 100;
        const chunkedVectors = chunkArr(preparedSources, batchSize);

        // await this.client
        //     .Index(this.indexName)
        //     .namespace(this.constructNsName(acRequest.candidate as AccessCandidate, namespace))
        //     .upsert(preparedSources);

        const promises = chunkedVectors.map(async (chunk) => {
            await this.client
                .Index(this.indexName)
                .namespace(this.constructNsName(acRequest.candidate as AccessCandidate, namespace))
                .upsert(chunk);
        });
        await Promise.all(promises);

        const accessCandidate = acRequest.candidate;

        const isNewNs = !(await this.requester(AccessCandidate.clone(accessCandidate)).namespaceExists(namespace));
        if (isNewNs) {
            let acl = new ACL().addAccess(accessCandidate.role, accessCandidate.id, TAccessLevel.Owner).ACL;
            await this.setACL(acRequest, namespace, acl);
        }

        return preparedSources.map((s) => {
            const { text, acl, user_metadata, ...restMetadata } = s.metadata || {};
            return {
                id: s.id,
                values: s.values as number[],
                text: text as string,
                metadata: {
                    ...restMetadata,
                    ...((typeof user_metadata === 'string' ? JSON.parse(user_metadata) : user_metadata) as Record<string, any>),
                },
            };
        });
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, namespace: string, deleteTarget: DeleteTarget): Promise<void> {
        const isDeleteByFilter = typeof deleteTarget === 'object' && !Array.isArray(deleteTarget);

        if (isDeleteByFilter) {
            // TODO: handle delete by filter logic
        } else {
            const _ids = Array.isArray(deleteTarget) ? deleteTarget : [deleteTarget];

            const batchSize = 800;
            const chunkedIds = chunkArr(_ids, batchSize);

            const promises = chunkedIds.map(async (chunk) => {
                await this.client
                    .Index(this.indexName)
                    .namespace(this.constructNsName(acRequest.candidate as AccessCandidate, namespace))
                    .deleteMany(chunk);
            });
            await Promise.all(promises);
        }
    }

    @SecureConnector.AccessControl
    protected async createDatasource(acRequest: AccessRequest, namespace: string, datasource: DatasourceDto): Promise<IStorageVectorDataSource> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const acl = new ACL().addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner);
        const dsId = datasource.id || crypto.randomUUID();

        if (!datasource.chunkSize) datasource.chunkSize = 2000;
        if (!datasource.chunkOverlap) datasource.chunkOverlap = 200;

        const formattedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);
        const chunkedText = this.embedder.chunkText(datasource.text, {
            chunkSize: datasource.chunkSize,
            chunkOverlap: datasource.chunkOverlap,
        });
        const label = datasource.label || 'Untitled';
        const ids = Array.from({ length: chunkedText.length }, (_, i) => `${dsId}_${crypto.randomUUID()}`);
        const source: IVectorDataSourceDto[] = chunkedText.map((doc, i) => {
            return {
                id: ids[i],
                source: doc,
                metadata: {
                    acl: acl.serializedACL,
                    namespaceId: formattedNs,
                    datasourceId: dsId,
                    datasourceLabel: label,
                    chunkIndex: i,
                    user_metadata: datasource.metadata ? jsonrepair(JSON.stringify(datasource.metadata)) : undefined,
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
            vectorIds: _vIds.map((v) => v.id),
            id: dsId,
            datasourceSizeMb: calcSizeMb(datasource.text),
            chunkSize: datasource.chunkSize,
            chunkOverlap: datasource.chunkOverlap,
            createdAt: new Date(),
        };
        if (datasource.returnFullVectorInfo) {
            dsData.vectorInfo = _vIds;
        }
        // const url = `smythfs://${teamId}.team/_datasources/${dsId}.json`;
        // await SmythFS.Instance.write(url, JSON.stringify(dsData), AccessCandidate.team(teamId));
        await this.nkvConnector
            .requester(acRequest.candidate as AccessCandidate)
            .set(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`, dsId, JSON.stringify(dsData));
        // return { id: dsId, vectorIds: _vIds };
        return dsData;
    }

    @SecureConnector.AccessControl
    protected async deleteDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<void> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);
        // const url = `smythfs://${teamId}.team/_datasources/${dsId}.json`;
        // await SmythFS.Instance.delete(url, AccessCandidate.team(teamId));
        let ds: IStorageVectorDataSource = JSONContentHelper.create(
            (
                await this.nkvConnector
                    .requester(acRequest.candidate as AccessCandidate)
                    .get(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`, datasourceId)
            )?.toString()
        ).tryParse();

        if (!ds || typeof ds !== 'object') {
            throw new Error(`Data source not found with id: ${datasourceId}`);
        }

        await this.delete(acRequest, namespace, ds.vectorIds || []);

        await this.nkvConnector
            .requester(acRequest.candidate as AccessCandidate)
            .delete(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`, datasourceId);
    }

    @SecureConnector.AccessControl
    protected async listDatasources(acRequest: AccessRequest, namespace: string): Promise<IStorageVectorDataSource[]> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);
        return (
            await this.nkvConnector
                .requester(acRequest.candidate as AccessCandidate)
                .list(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`)
        ).map((ds) => {
            return JSONContentHelper.create(ds.data?.toString()).tryParse() as IStorageVectorDataSource;
        });
    }

    @SecureConnector.AccessControl
    protected async getDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<IStorageVectorDataSource> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);
        return JSONContentHelper.create(
            (
                await this.nkvConnector
                    .requester(acRequest.candidate as AccessCandidate)
                    .get(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`, datasourceId)
            )?.toString()
        ).tryParse() as IStorageVectorDataSource;
    }

    private async setACL(acRequest: AccessRequest, preparedNs: string, acl: IACL): Promise<void> {
        await this.cache
            .requester(AccessCandidate.clone(acRequest.candidate))
            .set(`vectorDB:pinecone:namespace:${preparedNs}:acl`, JSON.stringify(acl));
    }

    private async getACL(ac: AccessCandidate, preparedNs: string): Promise<ACL | null | undefined> {
        let aclRes = await this.cache.requester(ac).get(`vectorDB:pinecone:namespace:${preparedNs}:acl`);
        const acl = JSONContentHelper.create(aclRes?.toString?.()).tryParse();
        return acl;
    }

    private async deleteACL(ac: AccessCandidate, preparedNs: string): Promise<void> {
        this.cache.requester(AccessCandidate.clone(ac)).delete(`vectorDB:pinecone:namespace:${preparedNs}:acl`);
    }

    public constructNsName(candidate: AccessCandidate, name: string) {
        const joinedName = name.trim().replace(/\s/g, '_').toLowerCase();
        let prefix = candidate.id;

        if (candidate.role !== TAccessRole.Team) {
            //DO NOT add role prefix for teams to preserve backward compatibility
            prefix = candidate.role[0] + '_' + candidate.id;
        }

        return `${prefix}_${joinedName}`;
    }
}
