export type VectorDBMetadata = ({ text?: string; user?: string } & Record<string, string>) | undefined;

export type VectorsResultData = {
    id: string;
    score?: number;
    values: number[];
    metadata?: ({ text?: string; user?: Record<string, string> } & Record<string, any>) | undefined;
}[];

export type PineconeConfig = {
    pineconeApiKey: string;
    openaiApiKey: string;
    indexName: string;
};

export interface NsKnownMetadata {
    isOnCustomStorage?: boolean;
    [key: string]: any;
}

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

// export interface IVectorDataSourceDto<T extends Source> {
//     id: string;
//     // source: url | text | document | vector;
//     source: T;
//     metadata?: VectorDBMetadata;
// }

export interface IVectorDataSourceDto {
    id: string;
    source: number[] | string;
    metadata?: VectorDBMetadata;
}

export interface IStorageVectorDataSource {
    namespaceId: string;
    // indexName: string;
    teamId: string;
    name: string;
    metadata: string;
    text: string;
    embeddingIds: string[];
}

export interface IStorageVectorNamespace {
    namespace: string;
    displayName: string;
    teamId: string;
    metadata?: StorageVectorNamespaceMetadata;
}

export type StorageVectorNamespaceMetadata = Partial<PineconeNamespaceMetadata> & { [key: string]: any };
export interface PineconeNamespaceMetadata {
    indexName: string;
}
