import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { VectorDBConnector } from './VectorDBConnector';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import crypto from 'crypto';
import { IVectorDataSourceDto, Source } from '@sre/types/VectorDB.types';
import { jsonrepair } from 'jsonrepair';

export class VectorsHelper {
    private _connector: VectorDBConnector;
    private embeddingsProvider: OpenAIEmbeddings;
    private _vectorDimention: number;

    constructor() {
        this._connector = ConnectorService.getVectorDBConnector();
        this.embeddingsProvider = new OpenAIEmbeddings();
        if (this._vectorDimention && !isNaN(this._vectorDimention)) {
            this.embeddingsProvider.dimensions = this._vectorDimention;
        }
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

    public async ingestText(
        text: string,
        namespace: string,
        {
            teamId,
            metadata,
            chunkSize = 4000,
            chunkOverlap = 500,
        }: {
            teamId?: string;
            metadata?: Record<string, string>;
            chunkSize?: number;
            chunkOverlap?: number;
        } = {}
    ) {
        const chunkedText = await VectorsHelper.chunkText(text, { chunkSize, chunkOverlap });
        const ids = Array.from({ length: chunkedText.length }, (_, i) => crypto.randomUUID());
        const source: IVectorDataSourceDto<string>[] = chunkedText.map((doc, i) => {
            return {
                id: ids[i],
                source: doc,
                metadata: {
                    user: VectorsHelper.stringifyMetadata(metadata), // user-speficied metadata
                },
            };
        });
        const _vIds = await this._connector.user(AccessCandidate.team(teamId)).insert(namespace, source);
        return _vIds;
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
