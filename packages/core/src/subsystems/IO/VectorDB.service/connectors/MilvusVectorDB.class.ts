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
import {
    DatasourceDto,
    IStorageVectorDataSource,
    IVectorDataSourceDto,
    QueryOptions,
    VectorDBResult,
    VectorsResultData,
} from '@sre/types/VectorDB.types';
import { calcSizeMb } from '@sre/utils/string.utils';
import { CreateIndexSimpleReq, DataType, ErrorCode, FieldType, MilvusClient } from '@zilliz/milvus2-sdk-node';
import crypto from 'crypto';
import { jsonrepair } from 'jsonrepair';
import { EmbeddingsFactory } from '../embed';
import { BaseEmbedding, TEmbeddings } from '../embed/BaseEmbedding';
import { DeleteTarget, VectorDBConnector } from '../VectorDBConnector';
import { NKVConnector } from '@sre/IO/NKV.service/NKVConnector';

//! Due to current bug (still investigating), any consumer of this connector
//! needs to install @zilliz/milvus2-sdk-node in the package.json of the project so it can work

//* Note, we are storing Datasources info inside both NKV and Milvus (using some quirks).
//* The connector favors NKV as storage number 1, and Milvus acting as fallback storage.
//* This is because Milvus operations are heavy and can be slow the more u add big datasources

const console = Logger('Milvus');

export type IMilvusCredentials = { address: string; token: string } | { address: string; user: string; password: string; token?: string };
type IndexParams = Omit<CreateIndexSimpleReq, 'collection_name'>[] | Omit<CreateIndexSimpleReq, 'collection_name'>;

export type MilvusConfig = {
    /**
     * The Milvus connection credentials
     */
    credentials: IMilvusCredentials;

    /**
     * The embeddings model to use
     */
    embeddings?: TEmbeddings;
};

// Define schema field names as a type for strong typing
type SchemaFieldNames = 'id' | 'text' | 'namespaceId' | 'datasourceId' | 'datasourceLabel' | 'vector' | 'acl' | 'user_metadata' | 'smyth_metadata';

type SchemaField = FieldType & { name: SchemaFieldNames };

export class MilvusVectorDB extends VectorDBConnector {
    public name = 'MilvusVectorDB';
    public id = 'milvus';
    private client: MilvusClient;
    private cache: CacheConnector;
    private accountConnector: AccountConnector;
    public embedder: BaseEmbedding;
    private SCHEMA_DEFINITION: SchemaField[];
    private INDEX_PARAMS: IndexParams;
    private nkvConnector: NKVConnector;

    constructor(protected _settings: MilvusConfig) {
        super(_settings);
        if (!_settings.credentials) {
            return;
        }

        // Create client config based on credential type
        const clientConfig = {
            address: _settings.credentials?.address,
            token: 'token' in _settings.credentials ? _settings.credentials.token : undefined,
            user: 'user' in _settings.credentials ? _settings.credentials.user : undefined,
            password: 'password' in _settings.credentials ? _settings.credentials.password : undefined,
        };

        console.log('clientConfig', clientConfig);

        this.client = new MilvusClient(clientConfig, undefined, undefined, undefined, {
            'grpc.max_receive_message_length': 50 * 1024 * 1024,
            'grpc.max_send_message_length': 50 * 1024 * 1024,
            max_receive_message_length: 50 * 1024 * 1024,
            max_send_message_length: 50 * 1024 * 1024,
        });
        console.info('Milvus client initialized');
        this.accountConnector = ConnectorService.getAccountConnector();
        this.cache = ConnectorService.getCacheConnector();
        this.nkvConnector = ConnectorService.getNKVConnector();

        if (!_settings.embeddings) {
            _settings.embeddings = { provider: 'OpenAI', model: 'text-embedding-3-large', dimensions: 3072 };
        }

        if (!_settings.embeddings?.dimensions) _settings.embeddings.dimensions = 3072;

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
            {
                name: 'smyth_metadata',
                data_type: DataType.VarChar,
                max_length: 65535,
            },
        ];
        this.INDEX_PARAMS = {
            index_type: 'AUTOINDEX',
            metric_type: 'COSINE', //TODO: make it configurable
            field_name: 'vector',
        };
        // this.options = _settings.options;
    }

    @SecureConnector.AccessControl
    protected async createNamespace(acRequest: AccessRequest, namespace: string, metadata?: { [key: string]: any }): Promise<void> {
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
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);

        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        const res = await this.client.dropCollection({
            collection_name: preparedNs,
        });

        if (res.error_code !== ErrorCode.SUCCESS) {
            throw new Error(`Error dropping collection: ${res}`);
        }

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
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        let _vector = query;
        if (typeof query === 'string') {
            _vector = await this.embedder.embedText(query, acRequest.candidate as AccessCandidate);
        }

        const result = await this.client.search({
            data: _vector as number[],
            collection_name: preparedNs,
            limit: options.topK || 10,
        });

        if (result.status.error_code !== ErrorCode.SUCCESS) {
            throw new Error(`Error searching data: ${result.status.detail}`);
        }

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
    ): Promise<VectorDBResult[]> {
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

        const liveSchema = await this.client.describeCollection({
            collection_name: preparedNs,
        });

        // only incl the fields that are in the live schema

        const preparedSource: Partial<Record<SchemaFieldNames, any>>[] = transformedSource.map((s) => {
            function schemaFieldExists(field: SchemaFieldNames) {
                return liveSchema.schema.fields.some((f) => f.name === field);
            }
            return {
                id: s.id,
                text: s.metadata?.text,
                user_metadata: s.metadata?.[this.USER_METADATA_KEY],
                namespaceId: preparedNs,
                datasourceId: s.metadata?.datasourceId, // legacy field
                datasourceLabel: s.metadata?.datasourceLabel, // legacy field
                vector: s.source,
                acl: s.metadata?.acl,
                ...(schemaFieldExists('smyth_metadata')
                    ? {
                          smyth_metadata: JSON.stringify({
                              datasource: {
                                  id: s.metadata?.datasourceId,
                                  label: s.metadata?.datasourceLabel,
                                  chunkSize: s.metadata?.chunkSize,
                                  chunkOverlap: s.metadata?.chunkOverlap,
                                  createdAt: s.metadata?.createdAt,
                                  datasourceSizeMb: s.metadata?.datasourceSizeMb,
                                  chunkIndex: s.metadata?.chunkIndex,
                              },
                          }),
                      }
                    : {}),
            };
        });

        const res = await this.client.insert({
            collection_name: preparedNs,
            data: preparedSource,
        });
        if (res.status.error_code !== ErrorCode.SUCCESS) {
            console.error('Error inserting data: ', res);
            throw new Error(`Error inserting data: ${res?.status?.error_code}`);
        }

        return preparedSource.map((s) => {
            const { text, acl, user_metadata, ...restMetadata } = s || {};
            return {
                id: s.id,
                values: s.vector as number[],
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
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        const isDeleteByFilter = typeof deleteTarget === 'object' && !Array.isArray(deleteTarget);
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
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const acl = new ACL().addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner);
        const dsId = datasource.id || crypto.randomUUID();

        if (!datasource.chunkSize) datasource.chunkSize = 1000;
        if (!datasource.chunkOverlap) datasource.chunkOverlap = 200;

        const formattedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);
        const chunkedText = this.embedder.chunkText(datasource.text, {
            chunkSize: datasource.chunkSize,
            chunkOverlap: datasource.chunkOverlap,
        });
        const ids = Array.from({ length: chunkedText.length }, (_, i) => crypto.randomUUID());
        const label = datasource.label || 'Untitled';
        const totalSizeMb = calcSizeMb(datasource.text);
        const source: IVectorDataSourceDto[] = chunkedText.map<IVectorDataSourceDto>((doc, i) => {
            return {
                id: ids[i],
                source: doc,
                metadata: {
                    acl: acl.serializedACL,
                    namespaceId: formattedNs,
                    datasourceId: dsId,
                    datasourceLabel: label,
                    chunkSize: datasource?.chunkSize?.toString(),
                    chunkOverlap: datasource?.chunkOverlap?.toString(),
                    createdAt: new Date().getTime().toString(),
                    datasourceSizeMb: totalSizeMb.toString(),
                    chunkIndex: i,
                    user_metadata: datasource.metadata ? jsonrepair(JSON.stringify(datasource.metadata)) : JSON.stringify({}),
                },
            };
        });

        const _vIds = await this.insert(acRequest, namespace, source);

        const dsData: IStorageVectorDataSource = {
            namespaceId: formattedNs,
            candidateId: acRequest.candidate.id,
            candidateRole: acRequest.candidate.role,
            name: label,
            metadata: datasource.metadata ? jsonrepair(JSON.stringify(datasource.metadata)) : undefined,
            text: datasource.text,
            vectorIds: _vIds.map((v) => v.id),
            id: dsId,
            chunkSize: datasource.chunkSize,
            chunkOverlap: datasource.chunkOverlap,
            createdAt: new Date(),
            datasourceSizeMb: totalSizeMb,
        };

        await this.nkvConnector
            .requester(acRequest.candidate as AccessCandidate)
            .set(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`, dsId, JSON.stringify(dsData));

        if (datasource.returnFullVectorInfo) {
            dsData.vectorInfo = _vIds;
        }
        return dsData;
    }

    @SecureConnector.AccessControl
    protected async deleteDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<void> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        await this.delete(acRequest, namespace, { datasourceId });

        await this.nkvConnector
            .requester(acRequest.candidate as AccessCandidate)
            .delete(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`, datasourceId);
    }

    @SecureConnector.AccessControl
    protected async listDatasources(acRequest: AccessRequest, namespace: string): Promise<IStorageVectorDataSource[]> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        //* [1] Get datasources from NKV
        try {
            const nkvDatasources = await this.nkvConnector
                .requester(acRequest.candidate as AccessCandidate)
                .list(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`)
                .then((ds) => ds.map((d) => JSONContentHelper.create(d.data?.toString()).tryParse() as IStorageVectorDataSource));

            return nkvDatasources;
        } catch (error) {
            console.error('[NKV] Error listing datasources: ', error);
        }

        console.info('Trying to get datasources from Milvus');
        //* [2] Get datasources from Milvus [EXPENSIVE OPERATION] that may exhaust rpc channel
        // Use queryIterator for memory-efficient pagination
        const batchSize = 1000; // Process 1000 records at a time
        const iterator = await this.client.queryIterator({
            collection_name: formattedNs,
            batchSize: batchSize,
            // output_fields: ['id', 'text', this.USER_METADATA_KEY, 'namespaceId', 'datasourceId', 'datasourceLabel', 'vector'],
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
                            // text: record.text,
                            name: record.datasourceLabel,
                            metadata: record[this.USER_METADATA_KEY]
                                ? JSONContentHelper.create(record[this.USER_METADATA_KEY].toString()).tryParse()
                                : undefined,
                            id: datasourceId,
                            vectorIds: [], // to be filled iteratively
                            text: '', // to be filled iteratively
                        });
                    }
                    datasourceMap.get(datasourceId)!.vectorIds.push(record.id);
                    // the text here represents the total text of the datasource (not a vector-stored text)
                    datasourceMap.get(datasourceId)!.text += record.text;
                }
            }
        } finally {
            // Always close the iterator to free resources
        }

        return Array.from(datasourceMap.values());
    }

    @SecureConnector.AccessControl
    protected async getDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<IStorageVectorDataSource | undefined> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        //* [1] Get datasource from NKV
        try {
            const nkvDatasource = await this.nkvConnector
                .requester(acRequest.candidate as AccessCandidate)
                .get(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`, datasourceId)
                .then((ds) => JSONContentHelper.create(ds?.toString()).tryParse() as IStorageVectorDataSource);

            if (nkvDatasource) {
                return nkvDatasource;
            } else {
                console.info('Datasource not found in NKV');
            }
        } catch (error) {
            console.error('[NKV] Error getting datasource: ', error);
        }

        console.info('Trying to get datasource from Milvus');

        //* [2] Get datasource from Milvus
        const res = await this.client.query({
            collection_name: formattedNs,
            expr: `datasourceId == "${datasourceId}"`,
            // output_fields: [
            //     'id',
            //     'text',
            //     this.USER_METADATA_KEY,
            //     'namespaceId',
            //     'datasourceId',
            //     'datasourceLabel',
            //     'vector',
            //     'chunkSize',
            //     'chunkOverlap',
            //     'createdAt',
            // ],
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
        await this.cache
            .requester(AccessCandidate.clone(acRequest.candidate))
            .set(`vectorDB:pinecone:namespace:${preparedNs}:acl`, JSON.stringify(acl));
    }

    private async getACL(ac: AccessCandidate, preparedNs: string): Promise<ACL | null | undefined> {
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
