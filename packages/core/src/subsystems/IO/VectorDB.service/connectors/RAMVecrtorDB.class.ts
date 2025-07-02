//==[ SRE: RAMVectorDB ]======================

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
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { OpenAIEmbeds } from '@sre/IO/VectorDB.service/embed/OpenAIEmbedding';
import crypto from 'crypto';
import { BaseEmbedding, TEmbeddings } from '../embed/BaseEmbedding';
import { EmbeddingsFactory } from '../embed';

const console = Logger('RAMVec');

interface VectorData {
    id: string;
    values: number[];
    datasource: string;
    metadata?: { [key: string]: any };
}

export type RAMVectorDBConfig = {
    embeddings: TEmbeddings;
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

    // In-memory storage
    private vectors: Record<string, VectorData[]> = {};
    private namespaces: Record<string, IStorageVectorNamespace> = {};
    private datasources: Record<string, Record<string, IStorageVectorDataSource>> = {};
    private acls: Record<string, IACL> = {};
    public embedder: BaseEmbedding;

    constructor(protected _settings: RAMVectorDBConfig) {
        super(_settings);

        this.accountConnector = ConnectorService.getAccountConnector();

        if (!_settings.embeddings) {
            _settings.embeddings = { provider: 'OpenAI', model: 'text-embedding-3-large', params: { dimensions: 1024 } };
        }
        if (!_settings.embeddings.params?.dimensions) _settings.embeddings.params.dimensions = 1024;

        this.embedder = EmbeddingsFactory.create(_settings.embeddings.provider, _settings.embeddings);
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        //const teamId = await this.accountConnector.getCandidateTeam(AccessCandidate.clone(candidate));
        const preparedNs = this.constructNsName(candidate as AccessCandidate, resourceId);
        const acl = this.acls[preparedNs];
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

        if (!this.namespaces[preparedNs]) {
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
            this.namespaces[preparedNs] = nsData;

            // Initialize namespace vectors storage
            this.vectors[preparedNs] = [];

            // Initialize datasources storage for this namespace
            this.datasources[preparedNs] = {};
        }

        // Store ACL in memory
        const acl = new ACL().addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
        this.acls[preparedNs] = acl;

        return new Promise<void>((resolve) => resolve());
    }

    @SecureConnector.AccessControl
    protected async namespaceExists(acRequest: AccessRequest, namespace: string): Promise<boolean> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);
        return !!this.namespaces[preparedNs];
    }

    @SecureConnector.AccessControl
    protected async getNamespace(acRequest: AccessRequest, namespace: string): Promise<IStorageVectorNamespace> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);
        const nsData = this.namespaces[preparedNs];
        if (!nsData) {
            throw new Error(`Namespace ${namespace} not found`);
        }
        return nsData;
    }

    @SecureConnector.AccessControl
    protected async listNamespaces(acRequest: AccessRequest): Promise<IStorageVectorNamespace[]> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);

        // Filter namespaces by team
        return Object.values(this.namespaces).filter((ns) => ns.candidateId === acRequest.candidate.id);
    }

    @SecureConnector.AccessControl
    protected async deleteNamespace(acRequest: AccessRequest, namespace: string): Promise<void> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        // Delete from memory
        delete this.vectors[preparedNs];
        delete this.namespaces[preparedNs];
        delete this.datasources[preparedNs];
        delete this.acls[preparedNs];
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

        if (!this.namespaces[preparedNs]) {
            throw new Error('Namespace does not exist');
        }

        // Get query vector
        let queryVector = query;
        if (typeof query === 'string') {
            queryVector = await this.embedder.embedText(query, acRequest.candidate as AccessCandidate);
        }

        // Search in namespace data
        const namespaceData = this.vectors[preparedNs] || [];
        const results: Array<{ id: string; score: number; values: number[]; metadata?: any; text: string }> = [];

        for (const vector of namespaceData) {
            const similarity = this.cosineSimilarity(queryVector as number[], vector.values);
            results.push({
                id: vector.id,
                score: similarity,
                values: vector.values,
                metadata: options.includeMetadata ? vector.metadata : undefined,
                text: vector.metadata?.text,
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
    ): Promise<string[]> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        const sources = Array.isArray(sourceWrapper) ? sourceWrapper : [sourceWrapper];
        const insertedIds: string[] = [];

        if (!this.vectors[preparedNs]) {
            this.vectors[preparedNs] = [];
        }

        for (const source of sources) {
            let vector: number[] = [];

            if (typeof source.source === 'string') {
                // Text embedding

                vector = await this.embedder.embedText(source.source, acRequest.candidate as AccessCandidate);
            } else {
                // Direct vector
                vector = source.source;
            }

            const vectorData: VectorData = {
                id: source.id,
                values: vector,
                datasource: source.metadata?.datasourceId || 'unknown',
                metadata: source.metadata,
            };

            // Check if vector with this ID already exists and update it
            const existingIndex = this.vectors[preparedNs].findIndex((v) => v.id === source.id);
            if (existingIndex >= 0) {
                this.vectors[preparedNs][existingIndex] = vectorData;
            } else {
                this.vectors[preparedNs].push(vectorData);
            }

            insertedIds.push(source.id);
        }

        return insertedIds;
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, namespace: string, id: string | string[]): Promise<void> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        const ids = Array.isArray(id) ? id : [id];

        if (this.vectors[preparedNs]) {
            this.vectors[preparedNs] = this.vectors[preparedNs].filter((vector) => !ids.includes(vector.id));
        }
    }

    @SecureConnector.AccessControl
    protected async createDatasource(acRequest: AccessRequest, namespace: string, datasource: DatasourceDto): Promise<IStorageVectorDataSource> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);
        const datasourceId = datasource.id || crypto.randomUUID();

        // Ensure namespace exists
        if (!this.namespaces[preparedNs]) {
            await this.createNamespace(acRequest, namespace);
        }

        // Process text and create vectors
        const vectorIds: string[] = [];

        // Split text into chunks if needed
        const chunkSize = datasource.chunkSize || 1000;
        const chunkOverlap = datasource.chunkOverlap || 200;
        const chunks = this.splitTextIntoChunks(datasource.text, chunkSize, chunkOverlap);

        // Initialize namespace vectors if not exists (should already exist if namespace was created properly)
        if (!this.vectors[preparedNs]) {
            this.vectors[preparedNs] = [];
        }

        for (let i = 0; i < chunks.length; i++) {
            const chunkId = `${datasourceId}_chunk_${i}`;
            const vector = await this.embedder.embedText(chunks[i], acRequest.candidate as AccessCandidate);

            const vectorData: VectorData = {
                id: chunkId,
                values: vector,
                datasource: datasourceId,
                metadata: {
                    ...datasource.metadata,
                    text: chunks[i],
                    chunkIndex: i,
                    totalChunks: chunks.length,
                },
            };

            this.vectors[preparedNs].push(vectorData);
            vectorIds.push(chunkId);
        }

        const storageDataSource: IStorageVectorDataSource = {
            namespaceId: preparedNs,
            candidateId: acRequest.candidate.id,
            candidateRole: acRequest.candidate.role,
            name: datasource.label || `Datasource ${datasourceId}`,
            metadata: JSON.stringify(datasource.metadata || {}),
            text: datasource.text,
            vectorIds,
            id: datasourceId,
        };

        // Store datasource metadata in memory
        if (!this.datasources[preparedNs]) {
            this.datasources[preparedNs] = {};
        }
        if (!this.datasources[preparedNs][datasourceId]) {
            this.datasources[preparedNs][datasourceId] = storageDataSource;
        } else {
            this.datasources[preparedNs][datasourceId].vectorIds.push(...vectorIds);
        }

        return storageDataSource;
    }

    @SecureConnector.AccessControl
    protected async deleteDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<void> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        // Ensure namespace exists
        if (!this.namespaces[preparedNs]) {
            throw new Error('Namespace does not exist');
        }

        // Get datasource info
        const datasource = this.datasources[preparedNs]?.[datasourceId];
        if (datasource) {
            // Delete all vectors belonging to this datasource
            if (this.vectors[preparedNs]) {
                this.vectors[preparedNs] = this.vectors[preparedNs].filter((vector) => vector.datasource !== datasourceId);
            }
        }

        // Delete datasource metadata
        if (this.datasources[preparedNs]) {
            delete this.datasources[preparedNs][datasourceId];
        }
    }

    @SecureConnector.AccessControl
    protected async listDatasources(acRequest: AccessRequest, namespace: string): Promise<IStorageVectorDataSource[]> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        const namespaceDatasources = this.datasources[preparedNs] || {};
        return Object.values(namespaceDatasources);
    }

    @SecureConnector.AccessControl
    protected async getDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<IStorageVectorDataSource> {
        //const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

        const datasource = this.datasources[preparedNs]?.[datasourceId];
        if (!datasource) {
            throw new Error(`Datasource ${datasourceId} not found`);
        }
        return datasource;
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

    /**
     * Split text into chunks with overlap
     */
    private splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
        const chunks: string[] = [];
        let start = 0;

        while (start < text.length) {
            const end = Math.min(start + chunkSize, text.length);
            chunks.push(text.slice(start, end));

            if (end === text.length) break;
            start = end - overlap;
        }

        return chunks;
    }
}
