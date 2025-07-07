import { ConnectorService } from '@sre/Core/ConnectorsService';
import { JSONContentHelper } from '@sre/helpers/JsonContent.helper';
import { Logger } from '@sre/helpers/Log.helper';
import { CacheConnector } from '@sre/MemoryManager/Cache.service/CacheConnector';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, IACL, TAccessLevel } from '@sre/types/ACL.types';
import { DatasourceDto, IStorageVectorDataSource, IVectorDataSourceDto, QueryOptions, VectorsResultData } from '@sre/types/VectorDB.types';
import { chunkText } from '@sre/utils/string.utils';
import crypto from 'crypto';
import { jsonrepair } from 'jsonrepair';
import { EmbeddingsFactory } from '../embed';
import { BaseEmbedding, TEmbeddings } from '../embed/BaseEmbedding';
import { DeleteTarget, VectorDBConnector } from '../VectorDBConnector';

import { LazyLoadFallback } from '@sre/utils/lazy-client';
import type * as MilvusTypes from '@zilliz/milvus2-sdk-node';

let MilvusModule: typeof MilvusTypes | undefined;
//#IFDEF STATIC MILVUS_STATIC
import * as _MilvusModule from '@zilliz/milvus2-sdk-node';
MilvusModule = _MilvusModule;
//#ENDIF

const console = Logger('Milvus');

export type IMilvusCredentials = { address: string; token: string } | { address: string; user: string; password: string; token?: string };
type IndexParams = Omit<MilvusTypes.CreateIndexSimpleReq, 'collection_name'>[] | Omit<MilvusTypes.CreateIndexSimpleReq, 'collection_name'>;

export type MilvusConfig = {
    credentials: IMilvusCredentials;
    embeddings: TEmbeddings;
};

// Define schema field names as a type for strong typing
type SchemaFieldNames = 'id' | 'text' | 'namespaceId' | 'datasourceId' | 'datasourceLabel' | 'vector' | 'acl' | 'user_metadata';

type SchemaField = MilvusTypes.FieldType & { name: SchemaFieldNames };

export class MilvusVectorDB extends VectorDBConnector {
    public name = 'MilvusVectorDB';
    public id = 'milvus';
    private client: MilvusTypes.MilvusClient;
    private cache: CacheConnector;
    private accountConnector: AccountConnector;
    public embedder: BaseEmbedding;
    private SCHEMA_DEFINITION: SchemaField[];
    private INDEX_PARAMS: IndexParams;

    constructor(protected _settings: MilvusConfig) {
        super(_settings);
        if (!_settings.credentials) {
            return;
        }
        this.lazyInit(_settings);
    }

    async lazyInit(_settings: MilvusConfig) {
        const { DataType, MilvusClient } = await LazyLoadFallback<typeof MilvusTypes>(MilvusModule, '@zilliz/milvus2-sdk-node');

        // Create client config based on credential type
        const clientConfig = {
            address: _settings.credentials?.address,
            token: 'token' in _settings.credentials ? _settings.credentials.token : undefined,
            user: 'user' in _settings.credentials ? _settings.credentials.user : undefined,
            password: 'password' in _settings.credentials ? _settings.credentials.password : undefined,
        };

        console.log('clientConfig', clientConfig);

        this.client = new MilvusClient(clientConfig);
        console.info('Milvus client initialized');
        this.accountConnector = ConnectorService.getAccountConnector();
        this.cache = ConnectorService.getCacheConnector();
        if (!_settings.embeddings.params) _settings.embeddings.params = { dimensions: 1024 };
        if (!_settings.embeddings.params?.dimensions) _settings.embeddings.params.dimensions = 1024;

        this.embedder = EmbeddingsFactory.create(_settings.embeddings.provider, _settings.embeddings);

        // Explicitly type the schema definition array
        this.SCHEMA_DEFINITION = [
            {
                name: 'id',
                data_type: DataType.VarChar,
                is_primary_key: true,
                max_length: 2048,
            },
            {
                name: 'text',
                data_type: DataType.VarChar,
                max_length: 65535, // max that milvus supports
            },
            {
                name: this.USER_METADATA_KEY, // user defined metadata
                data_type: DataType.VarChar,
                max_length: 65535,
            },
            {
                name: 'namespaceId',
                data_type: DataType.VarChar,
                max_length: 2048,
            },
            {
                name: 'datasourceId',
                data_type: DataType.VarChar,
                max_length: 2048,
            },
            {
                name: 'datasourceLabel',
                data_type: DataType.VarChar,
                max_length: 2048,
            },
            {
                name: 'vector',
                data_type: DataType.FloatVector,
                dim: this.embedder.dimensions, //* vector dimension
            },
            {
                name: 'acl',
                data_type: DataType.VarChar,
                max_length: 2048,
            },
        ];
        this.INDEX_PARAMS = {
            index_type: 'AUTOINDEX',
            metric_type: 'COSINE', //TODO: make it configurable
            field_name: 'vector',
        };
        // this.options = _settings.options;

        this.started = true;
    }

    @SecureConnector.AccessControl
    protected async createNamespace(acRequest: AccessRequest, namespace: string, metadata?: { [key: string]: any }): Promise<void> {
        await this.ready();
        //* Since Pinecone does not create explicit namespaces,
        //*  we create a zero or dummy vector in the namespace to trigger the namespace creation and filter it out

        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        const res = await this.client.createCollection({
            collection_name: preparedNs,
            schema: this.SCHEMA_DEFINITION,
            index_params: this.INDEX_PARAMS,
        });

        // await this.client.createIndex({
        //     collection_name: preparedNs,
        //     field_name: 'datasourceId',
        //     index_name: 'idx_datasourceId',
        //     index_type: 'STL_SORT',
        // });

        const acl = new ACL().addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
        await this.setACL(acRequest, preparedNs, acl);

        return new Promise<void>((resolve) => resolve());
    }

    @SecureConnector.AccessControl
    protected async namespaceExists(acRequest: AccessRequest, namespace: string): Promise<boolean> {
        await this.ready();
        const { ErrorCode } = await LazyLoadFallback<typeof MilvusTypes>(MilvusModule, '@zilliz/milvus2-sdk-node');
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const res = await this.client.hasCollection({
            collection_name: this.constructNsName(acRequest.candidate as AccessCandidate, namespace),
        });

        if (res.status.error_code !== ErrorCode.SUCCESS) {
            throw new Error(`Error checking collection: ${res}`);
        }

        return Boolean(res.value);
    }

    @SecureConnector.AccessControl
    protected async deleteNamespace(acRequest: AccessRequest, namespace: string): Promise<void> {
        await this.ready();
        const { ErrorCode } = await LazyLoadFallback<typeof MilvusTypes>(MilvusModule, '@zilliz/milvus2-sdk-node');
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);

        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        const res = await this.client.dropCollection({
            collection_name: preparedNs,
        });

        if (res.error_code !== ErrorCode.SUCCESS) {
            throw new Error(`Error dropping collection: ${res}`);
        }

        await this.deleteACL(AccessCandidate.clone(acRequest.candidate), namespace);
    }

    @SecureConnector.AccessControl
    protected async search(
        acRequest: AccessRequest,
        namespace: string,
        query: string | number[],
        options: QueryOptions = {}
    ): Promise<VectorsResultData> {
        await this.ready();
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        let _vector = query;
        if (typeof query === 'string') {
            _vector = await this.embedder.embedText(query, acRequest.candidate as AccessCandidate);
        }

        const result = await this.client.search({
            vector: _vector as number[],
            collection_name: preparedNs,
            output_fields: ['id', 'text', this.USER_METADATA_KEY, 'namespaceId', 'datasourceId', 'datasourceLabel', 'vector'],
            limit: options.topK || 10,
        });

        return result.results.map((match) => {
            let _record = match;
            if (match?.[this.USER_METADATA_KEY]) {
                _record[this.USER_METADATA_KEY] = JSONContentHelper.create(match[this.USER_METADATA_KEY].toString()).tryParse();
            }
            return {
                id: _record.id,
                values: _record.vector,
                text: _record.text,
                metadata: _record[this.USER_METADATA_KEY] ?? {},
                score: _record.score,
            };
        });
    }

    @SecureConnector.AccessControl
    protected async insert(
        acRequest: AccessRequest,
        namespace: string,
        sourceWrapper: IVectorDataSourceDto | IVectorDataSourceDto[]
    ): Promise<string[]> {
        await this.ready();
        const { ErrorCode } = await LazyLoadFallback<typeof MilvusTypes>(MilvusModule, '@zilliz/milvus2-sdk-node');
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        sourceWrapper = Array.isArray(sourceWrapper) ? sourceWrapper : [sourceWrapper];
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        // make sure that all sources are of the same type (source.source)
        if (sourceWrapper.some((s) => this.embedder.detectSourceType(s.source) !== this.embedder.detectSourceType(sourceWrapper[0].source))) {
            throw new Error('All sources must be of the same type');
        }

        const sourceType = this.embedder.detectSourceType(sourceWrapper[0].source);
        if (sourceType === 'unknown' || sourceType === 'url') throw new Error('Unsupported source type');
        const transformedSource = await this.embedder.transformSource(sourceWrapper, sourceType, acRequest.candidate as AccessCandidate);
        const preparedSource: Record<SchemaFieldNames, any>[] = transformedSource.map((s) => ({
            id: s.id,
            text: s.metadata?.text,
            user_metadata: s.metadata?.[this.USER_METADATA_KEY],
            namespaceId: preparedNs,
            datasourceId: s.metadata?.datasourceId,
            datasourceLabel: s.metadata?.datasourceLabel,
            vector: s.source,
            acl: s.metadata?.acl,
        }));

        const res = await this.client.insert({
            collection_name: preparedNs,
            data: preparedSource,
        });
        if (res.status.error_code !== ErrorCode.SUCCESS) {
            console.error('Error inserting data: ', res);
            throw new Error(`Error inserting data: ${res?.status?.error_code}`);
        }

        return preparedSource.map((s) => s.id);
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, namespace: string, deleteTarget: DeleteTarget): Promise<void> {
        await this.ready();
        const { ErrorCode } = await LazyLoadFallback<typeof MilvusTypes>(MilvusModule, '@zilliz/milvus2-sdk-node');
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        const isDeleteByFilter = typeof deleteTarget === 'object';
        if (isDeleteByFilter) {
            const supportedFields: SchemaFieldNames[] = ['datasourceId'];
            if (!supportedFields.some((field) => field in deleteTarget)) {
                throw new Error(`Unsupported field in delete target: ${Object.keys(deleteTarget).join(', ')}`);
            }
            // use boolean expression to delete the data
            const res = await this.client.deleteEntities({
                collection_name: preparedNs,
                expr: `datasourceId == "${(deleteTarget as any).datasourceId}"`,
            });
            if (res.status.error_code !== ErrorCode.SUCCESS) {
                throw new Error(`Error deleting data: ${res}`);
            }
        } else {
            const _ids = Array.isArray(deleteTarget) ? deleteTarget : [deleteTarget];

            const res = await this.client.delete({
                collection_name: preparedNs,
                ids: _ids as string[],
            });
            if (res.status.error_code !== ErrorCode.SUCCESS) {
                throw new Error(`Error deleting data: ${res}`);
            }
        }
    }

    @SecureConnector.AccessControl
    protected async createDatasource(acRequest: AccessRequest, namespace: string, datasource: DatasourceDto): Promise<IStorageVectorDataSource> {
        await this.ready();
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const acl = new ACL().addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner);
        const dsId = datasource.id || crypto.randomUUID();

        const formattedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);
        const chunkedText = chunkText(datasource.text, {
            chunkSize: datasource.chunkSize,
            chunkOverlap: datasource.chunkOverlap,
        });
        const ids = Array.from({ length: chunkedText.length }, (_, i) => crypto.randomUUID());
        const label = datasource.label || 'Untitled';
        const source: IVectorDataSourceDto[] = chunkedText.map<IVectorDataSourceDto>((doc, i) => {
            return {
                id: ids[i],
                source: doc,
                metadata: {
                    acl: acl.serializedACL,
                    namespaceId: formattedNs,
                    datasourceId: dsId,
                    datasourceLabel: label,
                    user_metadata: datasource.metadata ? jsonrepair(JSON.stringify(datasource.metadata)) : JSON.stringify({}),
                },
            };
        });

        const _vIds = await this.insert(acRequest, namespace, source);

        return {
            namespaceId: formattedNs,
            candidateId: acRequest.candidate.id,
            candidateRole: acRequest.candidate.role,
            name: label,
            metadata: datasource.metadata ? jsonrepair(JSON.stringify(datasource.metadata)) : undefined,
            text: datasource.text,
            vectorIds: _vIds,
            id: dsId,
        };
    }

    @SecureConnector.AccessControl
    protected async deleteDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<void> {
        await this.ready();
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        await this.delete(acRequest, namespace, { datasourceId });
    }

    @SecureConnector.AccessControl
    protected async listDatasources(acRequest: AccessRequest, namespace: string): Promise<IStorageVectorDataSource[]> {
        await this.ready();
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        // Use queryIterator for memory-efficient pagination
        const batchSize = 1000; // Process 1000 records at a time
        const iterator = await this.client.queryIterator({
            collection_name: formattedNs,
            batchSize: batchSize,
            output_fields: ['id', 'text', this.USER_METADATA_KEY, 'namespaceId', 'datasourceId', 'datasourceLabel', 'vector'],
        });

        // Group records by datasourceId using Map for efficient lookups
        const datasourceMap = new Map<string, IStorageVectorDataSource>();

        try {
            // Iterate through all pages
            for await (const batch of iterator) {
                for (const record of batch) {
                    const datasourceId = record.datasourceId;
                    if (!datasourceMap.has(datasourceId)) {
                        datasourceMap.set(datasourceId, {
                            namespaceId: formattedNs,
                            candidateId: acRequest.candidate.id,
                            candidateRole: acRequest.candidate.role,
                            text: record.text,
                            name: record.datasourceLabel,
                            metadata: record[this.USER_METADATA_KEY]
                                ? JSONContentHelper.create(record[this.USER_METADATA_KEY].toString()).tryParse()
                                : undefined,
                            vectorIds: [],
                            id: datasourceId,
                        });
                    }
                    datasourceMap.get(datasourceId)!.vectorIds.push(record.id);
                }
            }
        } finally {
            // Always close the iterator to free resources
        }

        return Array.from(datasourceMap.values());
    }

    @SecureConnector.AccessControl
    protected async getDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<IStorageVectorDataSource | undefined> {
        await this.ready();
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);
        const res = await this.client.query({
            collection_name: formattedNs,
            expr: `datasourceId == "${datasourceId}"`,
            output_fields: ['id', 'text', this.USER_METADATA_KEY, 'namespaceId', 'datasourceId', 'datasourceLabel', 'vector'],
        });
        // if 0 results, throw error
        if (res.data.length === 0) {
            return undefined;
        }

        const referenceRecord = res.data[0] as Record<SchemaFieldNames, any>;
        const allIds = res.data.map((d) => d.id);

        return {
            namespaceId: formattedNs,
            candidateId: acRequest.candidate.id,
            candidateRole: acRequest.candidate.role,
            text: referenceRecord.text,
            name: referenceRecord.datasourceLabel,
            metadata: referenceRecord[this.USER_METADATA_KEY]
                ? JSONContentHelper.create(referenceRecord[this.USER_METADATA_KEY].toString()).tryParse()
                : undefined,
            vectorIds: allIds,
            id: datasourceId,
        };
    }

    private async setACL(acRequest: AccessRequest, preparedNs: string, acl: IACL): Promise<void> {
        await this.ready();
        await this.cache
            .requester(AccessCandidate.clone(acRequest.candidate))
            .set(`vectorDB:pinecone:namespace:${preparedNs}:acl`, JSON.stringify(acl));
    }

    private async getACL(ac: AccessCandidate, preparedNs: string): Promise<ACL | null | undefined> {
        await this.ready();
        let aclRes = await this.cache.requester(ac).get(`vectorDB:pinecone:namespace:${preparedNs}:acl`);
        const acl = JSONContentHelper.create(aclRes?.toString?.()).tryParse();
        return acl;
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

    private async deleteACL(ac: AccessCandidate, preparedNs: string): Promise<void> {
        await this.ready();
        this.cache.requester(AccessCandidate.clone(ac)).delete(`vectorDB:pinecone:namespace:${preparedNs}:acl`);
    }

    public constructNsName(candidate: AccessCandidate, name: string) {
        // MILVUS does not accept special chars like - @ etc. so we need to ensure teamid is
        // valid; for this, instead of using teamId, we use a hash of the teamId and take
        const joinedName = name.trim().replace(/\s/g, '_').toLowerCase();
        let prefix = candidate.role[0] + '_' + candidate.id;
        // we also append a 'c' to the hash as milvus requires the coll name to start with a letter
        const hashTeamId = 'c' + crypto.createHash('sha256').update(prefix).digest('hex').slice(0, 8);
        return `${hashTeamId}_${joinedName}`;
    }
}
