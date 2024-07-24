export type VectorDBMetadata = Record<string, any> | undefined;

export type VectorsResultData = { [key: string]: any }[];

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
