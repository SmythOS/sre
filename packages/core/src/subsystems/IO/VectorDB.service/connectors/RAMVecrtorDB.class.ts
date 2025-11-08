//==[ SRE: RAMVectorDB ]======================

import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, IACL, TAccessLevel } from '@sre/types/ACL.types';
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
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { OpenAIEmbeds } from '@sre/IO/VectorDB.service/embed/OpenAIEmbedding';
import crypto from 'crypto';
import { BaseEmbedding, TEmbeddings } from '../embed/BaseEmbedding';
import { EmbeddingsFactory } from '../embed';

import { jsonrepair } from 'jsonrepair';

const console = Logger('RAM VectorDB');

interface VectorData {
    id: string;
    values: number[];
    datasource: string;
    metadata?: { [key: string]: any };
}

export type RAMVectorDBConfig = {
    /**
     * The embeddings model to use
     */
    embeddings?: TEmbeddings;
};

/**
 * RAM Vector Database - stores everything in memory
 * Data structure:
 * - vectors: namespace -> VectorData[]
 * - namespaces: namespace -> IStorageVectorNamespace
 * - datasources: namespace -> datasourceId -> IStorageVectorDataSource
 * - acls: resourceId -> IACL
 */

export class RAMVectorDB extends VectorDBConnector {
    public name = 'RAMVec';
    public id = 'ram';
    //private openaiApiKey: string;
    private accountConnector: AccountConnector;
    //private embeddingsProvider: OpenAIEmbeds;

    // In-memory storage (shared across connector instances)
    private static vectors: Record<string, VectorData[]> = {};
    private static namespaces: Record<string, IStorageVectorNamespace> = {};
    private static datasources: Record<string, Record<string, IStorageVectorDataSource>> = {};
    private static acls: Record<string, IACL> = {};

    //embedder
    public embedder: BaseEmbedding;

    constructor(protected _settings: RAMVectorDBConfig) {
        super(_settings);

        this.accountConnector = ConnectorService.getAccountConnector();

        if (!_settings.embeddings) {
            _settings.embeddings = { provider: 'OpenAI', model: 'text-embedding-3-large', dimensions: 1024 };
        }

        if (!_settings.embeddings.dimensions) _settings.embeddings.dimensions = 1024;

        this.embedder = EmbeddingsFactory.create(_settings.embeddings.provider, _settings.embeddings);
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        //const teamId = await this.accountConnector.getCandidateTeam(AccessCandidate.clone(candidate));
        const preparedNs = this.constructNsName(candidate as AccessCandidate, resourceId);
        const acl = RAMVectorDB.acls[preparedNs];
        const exists = !!acl;

        if (!exists) {
            //the resource does not exist yet, we grant write access to the candidate in order to allow the resource creation
            return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
        }
        return ACL.from(acl);
    }

    @SecureConnector.AccessControl
    protected async createNamespace(acRequest: AccessRequest, namespace: string, metadata?: { [key: string]: any }): Promise<void> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        if (!RAMVectorDB.namespaces[preparedNs]) {
            const nsData = {
                namespace: preparedNs,
                displayName: namespace,
                candidateId: acRequest.candidate.id,
                candidateRole: acRequest.candidate.role,
                metadata: {
                    ...metadata,
                    storageType: 'RAM',
                },
            };

            // Store namespace metadata in memory
            RAMVectorDB.namespaces[preparedNs] = nsData;

            // Initialize namespace vectors storage
            RAMVectorDB.vectors[preparedNs] = [];

            // Initialize datasources storage for this namespace
            RAMVectorDB.datasources[preparedNs] = {};
        }

        // Store ACL in memory
        const acl = new ACL().addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
        RAMVectorDB.acls[preparedNs] = acl;

        return new Promise<void>((resolve) => resolve());
    }

    @SecureConnector.AccessControl
    protected async namespaceExists(acRequest: AccessRequest, namespace: string): Promise<boolean> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);
        return !!RAMVectorDB.namespaces[preparedNs];
    }

    @SecureConnector.AccessControl
    protected async getNamespace(acRequest: AccessRequest, namespace: string): Promise<IStorageVectorNamespace> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);
        const nsData = RAMVectorDB.namespaces[preparedNs];
        if (!nsData) {
            throw new Error(`Namespace ${namespace} not found`);
        }
        return nsData;
    }

    @SecureConnector.AccessControl
    protected async listNamespaces(acRequest: AccessRequest): Promise<IStorageVectorNamespace[]> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);

        // Filter namespaces by team
        return Object.values(RAMVectorDB.namespaces).filter((ns) => ns.candidateId === acRequest.candidate.id);
    }

    @SecureConnector.AccessControl
    protected async deleteNamespace(acRequest: AccessRequest, namespace: string): Promise<void> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        // Delete from memory
        delete RAMVectorDB.vectors[preparedNs];
        delete RAMVectorDB.namespaces[preparedNs];
        delete RAMVectorDB.datasources[preparedNs];
        delete RAMVectorDB.acls[preparedNs];
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

        if (!RAMVectorDB.namespaces[preparedNs]) {
            throw new Error('Namespace does not exist');
        }

        // Get query vector
        let queryVector = query;
        if (typeof query === 'string') {
            queryVector = await this.embedder.embedText(query, acRequest.candidate as AccessCandidate);
        }

        // Search in namespace data
        const namespaceData = RAMVectorDB.vectors[preparedNs] || [];
        const results: Array<{ id: string; score: number; values: number[]; metadata?: any; text: string }> = [];

        for (const vector of namespaceData) {
            const similarity = this.cosineSimilarity(queryVector as number[], vector.values);

            let userMetadata = undefined;
            if (options.includeMetadata) {
                if (vector.metadata?.[this.USER_METADATA_KEY]) {
                    try {
                        userMetadata = JSON.parse(vector.metadata[this.USER_METADATA_KEY]);
                    } catch {
                        userMetadata = vector.metadata[this.USER_METADATA_KEY];
                    }
                } else {
                    userMetadata = {}; // Return empty object when no metadata exists, like Milvus
                }
            }

            results.push({
                id: vector.id,
                score: similarity,
                values: vector.values,
                text: vector.metadata?.text as string | undefined,
                metadata: options.includeMetadata ? userMetadata : undefined,
            });
        }

        // Sort by similarity (highest first) and limit results
        const topK = options.topK || 10;
        const sortedResults = results.sort((a, b) => b.score - a.score).slice(0, topK);

        return sortedResults;
    }

    @SecureConnector.AccessControl
    protected async insert(
        acRequest: AccessRequest,
        namespace: string,
        sourceWrapper: IVectorDataSourceDto | IVectorDataSourceDto[]
    ): Promise<VectorDBResult[]> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        sourceWrapper = Array.isArray(sourceWrapper) ? sourceWrapper : [sourceWrapper];

        // make sure that all sources are of the same type (source.source)
        if (sourceWrapper.some((s) => this.embedder.detectSourceType(s.source) !== this.embedder.detectSourceType(sourceWrapper[0].source))) {
            throw new Error('All sources must be of the same type');
        }

        const sourceType = this.embedder.detectSourceType(sourceWrapper[0].source);
        if (sourceType === 'unknown' || sourceType === 'url') throw new Error('Invalid source type');

        const transformedSource = await this.embedder.transformSource(sourceWrapper, sourceType, acRequest.candidate as AccessCandidate);

        if (!RAMVectorDB.vectors[preparedNs]) {
            RAMVectorDB.vectors[preparedNs] = [];
        }

        const insertedIds: VectorDBResult[] = [];

        for (const source of transformedSource) {
            const vectorData: VectorData = {
                id: source.id,
                values: source.source as number[],
                datasource: source.metadata?.datasourceId || 'unknown',
                metadata: source.metadata,
            };

            // Check if vector with this ID already exists and update it
            const existingIndex = RAMVectorDB.vectors[preparedNs].findIndex((v) => v.id === source.id);
            if (existingIndex >= 0) {
                RAMVectorDB.vectors[preparedNs][existingIndex] = vectorData;
            } else {
                RAMVectorDB.vectors[preparedNs].push(vectorData);
            }

            const { text, acl, user_metadata, ...restMetadata } = source.metadata || {};

            (insertedIds as VectorDBResult[]).push({
                id: source.id,
                values: source.source as number[],
                text: text as string,
                metadata: {
                    ...restMetadata,
                    ...((typeof user_metadata === 'string' ? JSON.parse(user_metadata) : user_metadata) as Record<string, any>),
                },
            });
            //insertedIds.push(source.id);
        }

        return insertedIds;
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, namespace: string, deleteTarget: DeleteTarget): Promise<void> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        const isDeleteByFilter = typeof deleteTarget === 'object' && !Array.isArray(deleteTarget);

        if (isDeleteByFilter) {
            // Handle delete by filter (e.g., by datasourceId)
            if ('datasourceId' in deleteTarget && deleteTarget.datasourceId) {
                if (RAMVectorDB.vectors[preparedNs]) {
                    RAMVectorDB.vectors[preparedNs] = RAMVectorDB.vectors[preparedNs].filter(
                        (vector) => vector.datasource !== deleteTarget.datasourceId
                    );
                }
            } else {
                throw new Error('Unsupported delete filter');
            }
        } else {
            // Handle delete by ID(s)
            const ids = Array.isArray(deleteTarget) ? deleteTarget : [deleteTarget];
            if (RAMVectorDB.vectors[preparedNs]) {
                RAMVectorDB.vectors[preparedNs] = RAMVectorDB.vectors[preparedNs].filter((vector) => !ids.includes(vector.id));
            }
        }
    }

    @SecureConnector.AccessControl
    protected async createDatasource(acRequest: AccessRequest, namespace: string, datasource: DatasourceDto): Promise<IStorageVectorDataSource> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const acl = new ACL().addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner);
        const dsId = datasource.id || crypto.randomUUID();

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
                    [this.USER_METADATA_KEY]: datasource.metadata ? jsonrepair(JSON.stringify(datasource.metadata)) : undefined,
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
        };

        if (datasource.returnFullVectorInfo) {
            dsData.vectorInfo = _vIds;
        }

        // Store datasource metadata in memory
        if (!RAMVectorDB.datasources[formattedNs]) {
            RAMVectorDB.datasources[formattedNs] = {};
        }
        RAMVectorDB.datasources[formattedNs][dsId] = dsData;

        return dsData;
    }

    @SecureConnector.AccessControl
    protected async deleteDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<void> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        // Delete all vectors belonging to this datasource using a filter by datasourceId,
        // so we remove vectors from any prior insert/update operations sharing the same datasource id
        await this.delete(acRequest, namespace, { datasourceId });

        // Delete datasource metadata (if present)
        if (RAMVectorDB.datasources[formattedNs] && RAMVectorDB.datasources[formattedNs][datasourceId]) {
            delete RAMVectorDB.datasources[formattedNs][datasourceId];
        }
    }

    @SecureConnector.AccessControl
    protected async listDatasources(acRequest: AccessRequest, namespace: string): Promise<IStorageVectorDataSource[]> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        const namespaceDatasources = RAMVectorDB.datasources[preparedNs] || {};
        return Object.values(namespaceDatasources);
    }

    @SecureConnector.AccessControl
    protected async getDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<IStorageVectorDataSource | undefined> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        const datasource = RAMVectorDB.datasources[preparedNs]?.[datasourceId];
        return datasource; // Return undefined if not found, like MilvusVectorDB
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        if (vecA.length !== vecB.length) {
            throw new Error('Vectors must have the same length');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (normA * normB);
    }
}
