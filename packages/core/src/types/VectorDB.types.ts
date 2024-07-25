export type VectorDBMetadata = ({ text?: string } & Record<string, any>) | undefined;

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

// export interface IDocument<Metadata extends Record<string, any> = Record<string, any>> {
//     text: string;
//     metadata: Metadata;
//     id?: string;
// }

export interface QueryOptions {
    topK?: number;
    includeMetadata?: boolean;
}

export interface SourceTypes {
    Vector: number[];
    Text: string;
}

export type Source = SourceTypes[keyof SourceTypes];

export interface IVectorDataSource<T extends Source> {
    id: string;
    // source: url | text | document | vector;
    source: T;
    metadata?: Record<string, string>;
}
