export type VectorDBMetadata = {
    namespaceId: string;
    datasourceId: string;
    datasourceLabel: string;
    acl: string;
    user_metadata?: string | Record<string, any>;
    text?: string;
};

export type VectorDBResult = {
    id: string;
    score?: number;
    values: number[];
    text: string;
    metadata?: Record<string, any>;
};

export type VectorsResultData = VectorDBResult[];

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
    name: string;
    metadata: string;
    text?: string;
    vectorIds: string[];
    vectorInfo?: VectorDBResult[];
    id: string;
    candidateId: string;
    candidateRole: string;
    datasourceSizeMb?: number;
    createdAt?: Date;
    chunkSize?: number;
    chunkOverlap?: number;
}

export interface IStorageVectorNamespace {
    namespace: string;
    displayName: string;
    metadata?: StorageVectorNamespaceMetadata;
    candidateId: string;
    candidateRole: string;
}

export type StorageVectorNamespaceMetadata = Partial<PineconeNamespaceMetadata> & { isOnCustomStorage?: boolean } & { [key: string]: any };
export interface PineconeNamespaceMetadata {
    indexName: string;
}

export interface DatasourceDto {
    text: string;
    metadata?: Record<string, string> & { smyth_metadata?: Record<string, string> };
    chunkSize?: number;
    chunkOverlap?: number;
    label?: string;
    id?: string;
    returnFullVectorInfo?: boolean;
}
