import { TEmbeddings } from '../../embed/BaseEmbedding';

export type PineconeAuthConfig = {
    vaultKey?: string;
    apiKey?: string;
};

export type PineconeRequestTimeouts = {
    defaultMs?: number;
    queryMs?: number;
    upsertMs?: number;
    deleteMs?: number;
    describeStatsMs?: number;
};

export type PineconeRetryConfig = {
    attempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    jitterRatio?: number;
};

export type PineconeHealthConfig = {
    failureThreshold?: number;
    recoveryThreshold?: number;
    probeIntervalMs?: number;
    cooldownMs?: number;
};

export type PineconeConnectorSettings = {
    indexName: string;
    embeddings?: TEmbeddings;
    auth?: PineconeAuthConfig;
    requestTimeouts?: PineconeRequestTimeouts;
    retry?: PineconeRetryConfig;
    health?: PineconeHealthConfig;
};

export type PineconeOperationName =
    | 'init'
    | 'describeIndexStats'
    | 'query'
    | 'upsert'
    | 'deleteMany'
    | 'deleteAll'
    | 'deleteNamespace'
    | 'createNamespace';
