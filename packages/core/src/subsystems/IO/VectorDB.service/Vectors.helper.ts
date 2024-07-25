import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { VectorDBConnector } from './VectorDBConnector';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import crypto from 'crypto';
import { Document } from '@langchain/core/documents';
import { IVectorDataSource, Source } from '@sre/types/VectorDB.types';

export class VectorsHelper {
    private _connector: VectorDBConnector;
    private embeddingsProvider: OpenAIEmbeddings;

    constructor() {
        this._connector = ConnectorService.getVectorDBConnector();
        this.embeddingsProvider = new OpenAIEmbeddings();
    }

    public static load() {
        return new VectorsHelper();
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
            metadata?: Record<string, any>;
            chunkSize?: number;
            chunkOverlap?: number;
        } = {}
    ) {
        const chunkedText = await VectorsHelper.chunkText(text, { chunkSize, chunkOverlap });
        const ids = Array.from({ length: chunkedText.length }, (_, i) => crypto.randomUUID());
        const source: IVectorDataSource<string>[] = chunkedText.map((doc, i) => {
            return {
                id: ids[i],
                source: doc,
                metadata: {},
            };
        });
        await this._connector.user(AccessCandidate.team(teamId)).insert(namespace, source);
    }

    public async embedText(text: string) {
        return this.embeddingsProvider.embedQuery(text);
    }

    public async embedTexts(texts: string[]) {
        return this.embeddingsProvider.embedDocuments(texts);
    }
}
