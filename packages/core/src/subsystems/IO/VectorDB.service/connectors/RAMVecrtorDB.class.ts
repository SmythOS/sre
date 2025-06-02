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
import { VectorsHelper } from '../../../../helpers/Vectors.helper';
import { Logger } from '@sre/helpers/Log.helper';
import { NKVConnector } from '@sre/IO/NKV.service/NKVConnector';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { JSONContentHelper } from '@sre/helpers/JsonContent.helper';
import { CacheConnector } from '@sre/MemoryManager/Cache.service/CacheConnector';
import crypto from 'crypto';

const console = Logger('RAM VectorDB');

interface RAMVectorConfig {
    openaiApiKey?: string;
    isCustomStorageInstance?: boolean;
}

interface StoredVector {
    id: string;
    values: number[];
    metadata?: { [key: string]: any };
    namespace: string;
}

interface SimilarityResult {
    id: string;
    values: number[];
    metadata?: { [key: string]: any };
    score: number;
}

export class RAMVectorDB extends VectorDBConnector {
    public name = 'RAMVectorDB';
    public id = 'ram';
    private vectors: Map<string, StoredVector> = new Map();
    private namespaceVectors: Map<string, Set<string>> = new Map();
    private redisCache: CacheConnector;
    private accountConnector: AccountConnector;
    private openaiApiKey: string;
    private nkvConnector: NKVConnector;
    private isCustomStorageInstance: boolean;

    constructor(config: RAMVectorConfig = {}) {
        super();
        console.info('RAM VectorDB initialized');

        this.accountConnector = ConnectorService.getAccountConnector();
        this.redisCache = ConnectorService.getCacheConnector('Redis');
        this.nkvConnector = ConnectorService.getNKVConnector();
        this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
        this.isCustomStorageInstance = config.isCustomStorageInstance || false;

        if (!this.openaiApiKey) {
            console.warn('OpenAI API key not provided - text embedding will not work');
        }
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
                    storageType: 'RAM',
                },
            };
            await this.nkvConnector.user(candidate).set(`vectorDB:${this.id}:namespaces`, preparedNs, JSON.stringify(nsData));

            // Initialize namespace in memory
            if (!this.namespaceVectors.has(preparedNs)) {
                this.namespaceVectors.set(preparedNs, new Set());
            }
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

        // Delete all vectors in this namespace from memory
        const vectorIds = this.namespaceVectors.get(preparedNs);
        if (vectorIds) {
            for (const vectorId of vectorIds) {
                this.vectors.delete(vectorId);
            }
            this.namespaceVectors.delete(preparedNs);
        }

        await this.deleteACL(AccessCandidate.clone(acRequest.candidate), namespace);
        await this.nkvConnector.user(candidate).delete(`vectorDB:${this.id}:namespaces`, preparedNs);
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

        let ns = await this.nkvConnector.user(AccessCandidate.team(teamId)).get(`vectorDB:${this.id}:namespaces`, preparedNs);

        if (!ns) {
            throw new Error('Namespace does not exist');
        }

        const nsData = JSONContentHelper.create(ns.toString()).tryParse() as IStorageVectorNamespace;
        if (nsData.metadata?.isOnCustomStorage && !this.isCustomStorageInstance) {
            throw new Error('Tried to access namespace on custom storage.');
        } else if (!nsData.metadata?.isOnCustomStorage && this.isCustomStorageInstance) {
            throw new Error('Tried to access namespace that is not on custom storage.');
        }

        let queryVector: number[];
        if (typeof query === 'string') {
            if (!this.openaiApiKey) {
                throw new Error('OpenAI API key is required for text queries');
            }
            queryVector = await VectorsHelper.load({ openaiApiKey: this.openaiApiKey }).embedText(query);
        } else {
            queryVector = query;
        }

        // Get all vectors in this namespace
        const vectorIds = this.namespaceVectors.get(preparedNs) || new Set();
        const results: SimilarityResult[] = [];

        for (const vectorId of vectorIds) {
            const vector = this.vectors.get(vectorId);
            if (vector) {
                const similarity = this.cosineSimilarity(queryVector, vector.values);
                results.push({
                    id: vector.id,
                    values: vector.values,
                    metadata: vector.metadata,
                    score: similarity,
                });
            }
        }

        // Sort by similarity score (highest first) and take top K
        const topK = options?.topK || 10;
        const sortedResults = results.sort((a, b) => b.score - a.score).slice(0, topK);

        return sortedResults.map((result) => {
            if (result.metadata?.user) {
                result.metadata.user = VectorsHelper.parseMetadata(result.metadata.user);
            }
            return {
                id: result.id,
                values: result.values,
                metadata: result.metadata,
            };
        });
    }

    @SecureConnector.AccessControl
    protected async insert(
        acRequest: AccessRequest,
        namespace: string,
        sourceWrapper: IVectorDataSourceDto | IVectorDataSourceDto[],
    ): Promise<string[]> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = VectorDBConnector.constructNsName(teamId, namespace);
        sourceWrapper = Array.isArray(sourceWrapper) ? sourceWrapper : [sourceWrapper];
        const helper = VectorsHelper.load({ openaiApiKey: this.openaiApiKey });

        // make sure that all sources are of the same type (source.source)
        if (sourceWrapper.some((s) => helper.detectSourceType(s.source) !== helper.detectSourceType(sourceWrapper[0].source))) {
            throw new Error('All sources must be of the same type');
        }

        const sourceType = helper.detectSourceType(sourceWrapper[0].source);
        if (sourceType === 'unknown' || sourceType === 'url') throw new Error('Invalid source type');
        const transformedSource = await helper.transformSource(sourceWrapper, sourceType);

        // Store vectors in memory
        const insertedIds: string[] = [];
        for (const source of transformedSource) {
            const vector: StoredVector = {
                id: source.id,
                values: source.source as number[],
                metadata: source.metadata,
                namespace: preparedNs,
            };

            this.vectors.set(source.id, vector);

            // Add to namespace index
            if (!this.namespaceVectors.has(preparedNs)) {
                this.namespaceVectors.set(preparedNs, new Set());
            }
            this.namespaceVectors.get(preparedNs)!.add(source.id);

            insertedIds.push(source.id);
        }

        const accessCandidate = acRequest.candidate;
        const isNewNs = await VectorsHelper.load({ openaiApiKey: this.openaiApiKey }).isNewNs(AccessCandidate.clone(accessCandidate), namespace);
        if (isNewNs) {
            let acl = new ACL().addAccess(accessCandidate.role, accessCandidate.id, TAccessLevel.Owner).ACL;
            await this.setACL(acRequest, namespace, acl);
        }

        return insertedIds;
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, namespace: string, id: string | string[]): Promise<void> {
        const _ids = Array.isArray(id) ? id : [id];
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const preparedNs = VectorDBConnector.constructNsName(teamId, namespace);

        // Remove vectors from memory
        for (const vectorId of _ids) {
            this.vectors.delete(vectorId);

            // Remove from namespace index
            const nsVectors = this.namespaceVectors.get(preparedNs);
            if (nsVectors) {
                nsVectors.delete(vectorId);
            }
        }
    }

    @SecureConnector.AccessControl
    protected async createDatasource(
        acRequest: AccessRequest,
        namespace: string,
        datasource: DatasourceDto,
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
                    user: VectorsHelper.stringifyMetadata(datasource.metadata), // user-specified metadata
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

        await this.nkvConnector
            .user(AccessCandidate.team(teamId))
            .set(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`, dsId, JSON.stringify(dsData));
        return { id: dsId, vectorIds: _vIds };
    }

    @SecureConnector.AccessControl
    protected async deleteDatasource(acRequest: AccessRequest, namespace: string, datasourceId: string): Promise<void> {
        const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
        const formattedNs = VectorDBConnector.constructNsName(teamId, namespace);

        let ds: IStorageVectorDataSource = JSONContentHelper.create(
            (
                await this.nkvConnector
                    .user(AccessCandidate.team(teamId))
                    .get(`vectorDB:${this.id}:namespaces:${formattedNs}:datasources`, datasourceId)
            )?.toString(),
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
            },
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
            )?.toString(),
        ).tryParse() as IStorageVectorDataSource;
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

    private async setACL(acRequest: AccessRequest, preparedNs: string, acl: IACL): Promise<void> {
        await this.redisCache
            .user(AccessCandidate.clone(acRequest.candidate))
            .set(`vectorDB:${this.id}:namespace:${preparedNs}:acl`, JSON.stringify(acl));
    }

    private async getACL(ac: AccessCandidate, preparedNs: string): Promise<ACL | null | undefined> {
        let aclRes = await this.redisCache.user(ac).get(`vectorDB:${this.id}:namespace:${preparedNs}:acl`);
        const acl = JSONContentHelper.create(aclRes?.toString?.()).tryParse();
        return acl;
    }

    private async deleteACL(ac: AccessCandidate, preparedNs: string): Promise<void> {
        this.redisCache.user(AccessCandidate.clone(ac)).delete(`vectorDB:${this.id}:namespace:${preparedNs}:acl`);
    }
}
