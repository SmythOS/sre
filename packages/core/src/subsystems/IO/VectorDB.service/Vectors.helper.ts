import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { VectorDBConnector } from './VectorDBConnector';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import crypto from 'crypto';
import { Document } from '@langchain/core/documents';
import { IDocument } from '@sre/types/VectorDB.types';

export class VectorsHelper {
    private _connector: VectorDBConnector;

    constructor() {
        this._connector = ConnectorService.getVectorDBConnector();
    }

    public static load() {
        return new VectorsHelper();
    }

    public static async chunkTextToDocuments(
        text: string,
        {
            chunkSize = 4000,
            chunkOverlap = 500,
        }: {
            chunkSize?: number;
            chunkOverlap?: number;
        } = {}
    ) {
        const preContentPerChunk = '';
        const postContentPerChunk = '';

        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize,
            chunkOverlap,
        });
        let output = await textSplitter.createDocuments([text]);

        output = output.map((chunk) => ({
            ...chunk,
            pageContent: `${preContentPerChunk} ${chunk.pageContent} ${postContentPerChunk}`.replace(/\s\s+/g, ' '),
        }));

        return output;
    }

    public async splitAndIngestContent(
        text: string,
        namespace: string,

        {
            chunkSize = 4000,
            chunkOverlap = 500,
            teamId,
            metadata,
        }: {
            chunkSize?: number;
            chunkOverlap?: number;
            teamId?: string;
            metadata?: Record<string, any>;
        } = {}
    ) {
        const documents = await VectorsHelper.chunkTextToDocuments(text, { chunkSize, chunkOverlap });
        const ids = Array.from({ length: documents.length }, (_, i) => crypto.randomUUID());
        const documentObjects: IDocument[] = documents.map((doc, i) => {
            return {
                metadata,
                id: ids[i],
                text: doc.pageContent,
            };
        });
        await this._connector.user(AccessCandidate.team(teamId)).fromDocuments(namespace, documentObjects);
    }
}
