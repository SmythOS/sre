//==[ SRE: S3Storage ]======================

import { createLogger } from '@sre/Core/Logger';
import { IStorageRequest, StorageConnector } from '@sre/IO/Storage.service/StorageConnector';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, IACL, TAccessLevel, TAccessResult, TAccessRole } from '@sre/types/ACL.types';

import SmythRuntime from '@sre/Core/SmythRuntime.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IVectorDBRequest, VectorDBConnector } from '../VectorDBConnector';
import { IDocument, PineconeConfig, VectorDBMetadata } from '@sre/types/VectorDB.types';
import { Pinecone } from '@pinecone-database/pinecone';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { OpenAIEmbeddings } from '@langchain/openai';

const console = createLogger('Pinecone VectorDB');

export class PineconeVectorDB extends VectorDBConnector {
    public name = 'PineconeVectorDB';
    private _client: Pinecone;
    private indexName: string;
    private _embeddingsProvider: OpenAIEmbeddings;

    constructor(private config: PineconeConfig) {
        super();
        if (!SmythRuntime.Instance) throw new Error('SRE not initialized');
        this._client = new Pinecone({
            apiKey: config.pineconeApiKey,
        });
        this._embeddingsProvider = new OpenAIEmbeddings({
            apiKey: config.openaiApiKey,
        });
        this.indexName = config.indexName;
    }

    public get client() {
        return this._client;
    }

    public get embeddings() {
        return this._embeddingsProvider;
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        //FIXME: store the ACLs in a durable storage. currently, they are stored in cache.

        const namespaceId = resourceId;

        //FIXME enable ACL check. For now, we return Owner access to all resources
        // const metadata = await this.getNamespaceMetadata(namespaceId);

        // if (!metadata) {
        return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
        // }

        // return ACL.from(metadata.acl as IACL);
    }

    // @SecureConnector.AccessControl
    public user(candidate: AccessCandidate): IVectorDBRequest {
        // check the index exists

        // const indexExists = await this._client
        //     .Index(this.indexName)
        //     .describeIndexStats()
        //     .catch((err) => {
        //         return false;
        //     });

        // if (!indexExists) {
        //     throw new Error(`Index ${this.indexName} does not exist`);
        // }

        return {
            query: async (namespace: string, query: string, topK: number) => {
                return await this.query(candidate.readRequest, { indexName: this.indexName, namespace, query, topK });
            },

            searchByVector: async (namespace: string, vector: number[], topK: number) => {
                return await this.searchByVector(candidate.readRequest, { indexName: this.indexName, namespace, vector, topK });
            },

            insert: async (namespace: string, vectors: { id: string; values: number[]; metadata?: VectorDBMetadata }[]) => {
                await this.insert(candidate.writeRequest, { indexName: this.indexName, namespace, vectors });
            },
            fromDocuments: async (namespace: string, documents: IDocument[]) => {
                await this.fromDocuments(candidate.writeRequest, namespace, documents);
            },
            delete: async (namespace: string, ids: string[]) => {
                await this.delete(candidate.writeRequest, { ids, indexName: this.indexName, namespace });
            },
            createNamespace: async (namespace: string) => {
                await this.createNamespace(candidate.writeRequest, namespace, this.indexName);
            },
            deleteNamespace: async (namespace: string) => {
                await this.deleteNamespace(candidate.writeRequest, namespace, this.indexName);
            },
        };
    }

    @SecureConnector.AccessControl
    protected async createNamespace(acRequest: AccessRequest, namespace: string, indexName: string): Promise<void> {
        //* Pinecone does not need explicit namespace creation, instead, it creates the namespace when the first vector is inserted

        // store ACL
        //FIXME: store the ACLs in a durable storage. //!

        // POSSIBLE PROBLEM: maybe we need to prefix the namespace with the a unique id in case of mutliple users/agents etc.

        return new Promise<void>((resolve) => resolve());
    }

    @SecureConnector.AccessControl
    protected async deleteNamespace(acRequest: AccessRequest, namespace: string, indexName: string): Promise<void> {
        await this._client.Index(indexName).namespace(namespace).deleteAll();

        //TODO: delete ACL
    }

    @SecureConnector.AccessControl
    protected async query(
        acRequest: AccessRequest,
        data: { indexName: string; namespace: string; query: string; topK: number }
    ): Promise<{ [key: string]: any }[]> {
        const pineconeIndex = this.client.Index(data.indexName).namespace(data.namespace);

        /* Search the vector DB independently with metadata filters */
        // const results = await vectorStore.similaritySearch(data.query, data.topK);
        const v = await this._embeddingsProvider.embedQuery(data.query);
        const results = await pineconeIndex.query({
            topK: data.topK,
            vector: v,
            includeMetadata: true,
            includeValues: true,
        });

        return results.matches;
    }

    @SecureConnector.AccessControl
    protected async searchByVector(
        acRequest: AccessRequest,
        data: { indexName: string; namespace: string; vector: number[]; topK: number }
    ): Promise<{ [key: string]: any }[]> {
        const results = await this.client.Index(data.indexName).namespace(data.namespace).query({
            topK: data.topK,
            vector: data.vector,
            includeMetadata: true,
            includeValues: true,
        });

        return results.matches;
    }

    @SecureConnector.AccessControl
    protected async insert(
        acRequest: AccessRequest,
        data: { indexName: string; namespace: string; vectors: { id: string; values: number[]; metadata?: VectorDBMetadata }[] }
    ): Promise<void> {
        const embeddingsNow = process.hrtime.bigint();
        // await pineconeStore.addDocuments(chunks, ids);
        await this._client.Index(data.indexName).namespace(data.namespace).upsert(data.vectors);
        const embeddingsAfter = process.hrtime.bigint();
        const embeddingsTime = Number(embeddingsAfter - embeddingsNow) / 1e6;
        console.info(`Added ${data.vectors.length} vectors in ${embeddingsTime}ms`);
    }

    @SecureConnector.AccessControl
    protected async fromDocuments(acRequest: AccessRequest, namespace: string, documents: IDocument[]): Promise<void> {
        // await PineconeStore.fromDocuments(documents, this._embeddingsProvider, {
        //     pineconeIndex: this._client.Index(this.indexName).namespace(namespace),
        //     namespace,
        //     maxConcurrency: 5, // Maximum number of batch requests to allow at once. Each batch is 1000 vectors.
        // });

        const texts = documents.map(({ text }) => text);
        return this.insert(acRequest, {
            indexName: this.indexName,
            namespace,
            vectors: (await this.embeddings.embedDocuments(texts)).map((vector, i) => ({
                id: documents[i].id,
                values: vector,
                metadata: {
                    ...documents[i].metadata,
                    text: texts[i],
                },
            })),
        });
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, data: { ids: string[]; indexName: string; namespace?: string }): Promise<void> {
        const res = await this._client.Index(data.indexName).namespace(data.namespace).deleteMany(data.ids);
    }

    private async getNamespaceMetadata(namespaceId: string): Promise<Record<string, any>> {
        const cache = ConnectorService.getCacheConnector();

        const metadata = await cache.get(namespaceId);

        return metadata;
    }
}
