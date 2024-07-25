export type VectorDBMetadata = Record<string, any> | undefined;

export type VectorsResultData = {
    id: string;
    score?: number;
    values: number[];
    metadata?: VectorDBMetadata;
}[];

export type PineconeConfig = {
    pineconeApiKey: string;
    openaiApiKey: string;
    indexName: string;
};

export interface IDocument<Metadata extends Record<string, any> = Record<string, any>> {
    text: string;
    metadata: Metadata;
    id?: string;
}
