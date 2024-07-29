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
import { IVectorDataSourceDto, PineconeConfig, QueryOptions, Source, VectorDBMetadata, VectorsResultData } from '@sre/types/VectorDB.types';
import { Pinecone } from '@pinecone-database/pinecone';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { OpenAIEmbeddings } from '@langchain/openai';
import { VectorsHelper } from '../Vectors.helper';
import { isUrl } from '@sre/utils/data.utils';

const console = createLogger('Pinecone VectorDB');

type SupportedSources = 'text' | 'vector' | 'url';

export class PineconeVectorDB extends VectorDBConnector {
    public name = 'PineconeVectorDB';
    private _client: Pinecone;
    private indexName: string;

    constructor(private config: PineconeConfig) {
        super();
        if (!SmythRuntime.Instance) throw new Error('SRE not initialized');
        this._client = new Pinecone({
            apiKey: config.pineconeApiKey,
        });

        this.indexName = config.indexName;
    }

    public get client() {
        return this._client;
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
        // search: async (namespace: string, query: string, options: QueryOptions) => {
        //     return (await this.search(candidate.readRequest, { indexName: this.indexName, namespace, query }, options)).map((match) => ({
        //         id: match.id,
        //         values: match.values,
        //         metadata: match.metadata,
        //     }));
        // },
        return {
            search: async (namespace: string, query: string | number[], options: QueryOptions) => {
                return await this.search(candidate.readRequest, { indexName: this.indexName, namespace, query }, options);
            },

            insert: async (namespace: string, source: IVectorDataSourceDto<Source> | IVectorDataSourceDto<Source>[]) => {
                return this.insert(candidate.writeRequest, { indexName: this.indexName, namespace, source });
            },

            delete: async (namespace: string, id: string | string[]) => {
                await this.delete(candidate.writeRequest, { id, indexName: this.indexName, namespace });
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
    protected async search(
        acRequest: AccessRequest,
        data: { indexName: string; namespace: string; query: string | number[] },
        options: QueryOptions = {}
    ): Promise<VectorsResultData> {
        const pineconeIndex = this.client.Index(data.indexName).namespace(data.namespace);
        let _vector = data.query;
        if (typeof data.query === 'string') {
            _vector = await VectorsHelper.load().embedText(data.query);
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
    protected async insert<T extends Source>(
        acRequest: AccessRequest,
        data: { indexName: string; namespace: string; source: IVectorDataSourceDto<T> | IVectorDataSourceDto<T>[] }
    ): Promise<string[]> {
        let { source } = data;
        source = Array.isArray(source) ? source : [source];

        const sourceType = this.detectSourceType(source[0].source);
        if (sourceType === 'unknown' || sourceType === 'url') throw new Error('Invalid source type');
        const transformedSource = await this.transformSource(source, sourceType);
        const preparedSource = transformedSource.map((s) => ({
            id: s.id,
            values: s.source as number[],
            metadata: s.metadata,
        }));

        // await pineconeStore.addDocuments(chunks, ids);
        await this._client.Index(data.indexName).namespace(data.namespace).upsert(preparedSource);

        return preparedSource.map((s) => s.id);
    }

    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, data: { id: string | string[]; indexName: string; namespace?: string }): Promise<void> {
        const _ids = Array.isArray(data.id) ? data.id : [data.id];
        const res = await this._client.Index(data.indexName).namespace(data.namespace).deleteMany(_ids);
    }

    private async getNamespaceMetadata(namespaceId: string): Promise<Record<string, any>> {
        const cache = ConnectorService.getCacheConnector();

        const metadata = await cache.get(namespaceId);

        return metadata;
    }

    private detectSourceType(source: Source): SupportedSources | 'unknown' {
        if (typeof source === 'string') {
            return isUrl(source) ? 'url' : 'text';
        } else if (Array.isArray(source) && source.every((v) => typeof v === 'number')) {
            return 'vector';
        } else {
            return 'unknown';
        }
    }

    private transformSource<T extends Source>(source: IVectorDataSourceDto<T>[], sourceType: SupportedSources) {
        //* as the accepted sources increases, you will need to implement the strategy pattern instead of a switch case
        switch (sourceType) {
            case 'text': {
                const texts = source.map((s) => s.source as string);

                return VectorsHelper.load()
                    .embedTexts(texts)
                    .then((vectors) => {
                        return source.map((s, i) => ({
                            ...s,
                            source: vectors[i],
                            metadata: { ...s.metadata, text: texts[i] },
                        }));
                    });
            }
            case 'vector': {
                return source;
            }
        }
    }
}
