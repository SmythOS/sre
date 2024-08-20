import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { VectorDBConnector } from './VectorDBConnector';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import crypto from 'crypto';
import { IStorageVectorDataSource, IVectorDataSourceDto, Source } from '@sre/types/VectorDB.types';
import { jsonrepair } from 'jsonrepair';
import { NKVConnector } from '../NKV.service/NKVConnector';
import { JSONContentHelper } from '@sre/helpers/JsonContent.helper';

export class VectorsHelper {
    private _vectorDBconnector: VectorDBConnector;
    private embeddingsProvider: OpenAIEmbeddings;
    private _vectorDimention: number;
    private _nkvConnector: NKVConnector;

    constructor() {
        this._vectorDBconnector = ConnectorService.getVectorDBConnector();
        this.embeddingsProvider = new OpenAIEmbeddings();
        if (this._vectorDimention && !isNaN(this._vectorDimention)) {
            this.embeddingsProvider.dimensions = this._vectorDimention;
        }
        this._nkvConnector = ConnectorService.getNKVConnector();
    }

    public static load(options: { vectorDimention?: number } = {}) {
        const instance = new VectorsHelper();
        options.vectorDimention && instance.setVectorDimention(options.vectorDimention);

        return instance;
    }

    public setVectorDimention(vectorDimention: number) {
        this._vectorDimention = vectorDimention;
    }

    public static async chunkText(
        text: string,
        {
            chunkSize = 4000,
            chunkOverlap = 500,
        }: {
            chunkSize?: number;
            chunkOverlap?: number;
        } = {}
    ): Promise<string[]> {
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize,
            chunkOverlap,
        });
        let output = await textSplitter.splitText(text);

        return output;
    }

    public async createDatasource(
        text: string,
        namespace: string,
        {
            teamId,
            metadata,
            chunkSize = 4000,
            chunkOverlap = 500,
            label,
            id,
        }: {
            teamId?: string;
            metadata?: Record<string, string>;
            chunkSize?: number;
            chunkOverlap?: number;
            label?: string;
            id?: string;
        } = {}
    ) {
        const formattedNs = VectorDBConnector.constructNsName(namespace, teamId);
        const chunkedText = await VectorsHelper.chunkText(text, { chunkSize, chunkOverlap });
        const ids = Array.from({ length: chunkedText.length }, (_, i) => crypto.randomUUID());
        const source: IVectorDataSourceDto[] = chunkedText.map((doc, i) => {
            return {
                id: ids[i],
                source: doc,
                metadata: {
                    user: VectorsHelper.stringifyMetadata(metadata), // user-speficied metadata
                },
            };
        });
        const _vIds = await this._vectorDBconnector.user(AccessCandidate.team(teamId)).insert(namespace, source);
        const dsId = id || crypto.randomUUID();

        const dsData: IStorageVectorDataSource = {
            namespaceId: formattedNs,
            teamId,
            name: label || 'Untitled',
            metadata: VectorsHelper.stringifyMetadata(metadata),
            text,
            embeddingIds: _vIds,
        };
        // const url = `smythfs://${teamId}.team/_datasources/${dsId}.json`;
        // await SmythFS.Instance.write(url, JSON.stringify(dsData), AccessCandidate.team(teamId));
        await this._nkvConnector
            .user(AccessCandidate.team(teamId))
            .set(`vectorDB:pinecone:namespaces:${formattedNs}:datasources`, dsId, JSON.stringify(dsData));
        return dsId;
    }

    public async listDatasources(teamId: string, namespace: string) {
        const formattedNs = VectorDBConnector.constructNsName(namespace, teamId);
        return (await this._nkvConnector.user(AccessCandidate.team(teamId)).list(`vectorDB:pinecone:namespaces:${formattedNs}:datasources`)).map(
            (ds) => {
                return {
                    id: ds.key,
                    data: JSONContentHelper.create(ds.data?.toString()).tryParse() as IStorageVectorDataSource,
                };
            }
        );
    }

    public async getDatasource(teamId: string, namespace: string, dsId: string) {
        const formattedNs = VectorDBConnector.constructNsName(namespace, teamId);
        return JSONContentHelper.create(
            (
                await this._nkvConnector.user(AccessCandidate.team(teamId)).get(`vectorDB:pinecone:namespaces:${formattedNs}:datasources`, dsId)
            )?.toString()
        ).tryParse() as IStorageVectorDataSource;
    }

    public async deleteDatasource(teamId: string, namespace: string, dsId: string) {
        const formattedNs = VectorDBConnector.constructNsName(namespace, teamId);
        // const url = `smythfs://${teamId}.team/_datasources/${dsId}.json`;
        // await SmythFS.Instance.delete(url, AccessCandidate.team(teamId));
        let ds: IStorageVectorDataSource = JSONContentHelper.create(
            (
                await this._nkvConnector.user(AccessCandidate.team(teamId)).get(`vectorDB:pinecone:namespaces:${formattedNs}:datasources`, dsId)
            )?.toString()
        ).tryParse();

        if (!ds || typeof ds !== 'object') {
            throw new Error(`Data source not found with id: ${dsId}`);
        }

        await this._vectorDBconnector.user(AccessCandidate.team(teamId)).delete(namespace, ds.embeddingIds || []);

        this._nkvConnector.user(AccessCandidate.team(teamId)).delete(`vectorDB:pinecone:namespaces:${formattedNs}:datasources`, dsId);
    }

    public async embedText(text: string) {
        return this.embeddingsProvider.embedQuery(text);
    }

    public async embedTexts(texts: string[]) {
        return this.embeddingsProvider.embedDocuments(texts);
    }

    public static stringifyMetadata(metadata: any) {
        try {
            return jsonrepair(JSON.stringify(metadata));
        } catch (err) {
            return metadata;
        }
    }
}
