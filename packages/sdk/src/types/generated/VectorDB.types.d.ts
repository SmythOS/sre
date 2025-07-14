import { MilvusConfig } from '@smythos/sre';
import { PineconeConfig } from '@smythos/sre';
import { RAMVectorDBConfig } from '@smythos/sre';
import { AccessCandidate } from '@smythos/sre';
import { VectorDBInstance } from '../../VectorDB/VectorDBInstance.class';
import { Scope } from '../SDKTypes';
export type TVectorDBProviderSettings = {
    Milvus: MilvusConfig;
    Pinecone: PineconeConfig;
    RAMVec: RAMVectorDBConfig;
};
export type TAllVectorDBProviderSettings = TVectorDBProviderSettings & IVectorDBProviders;
export type TBuiltinVectorDBProvider = keyof TVectorDBProviderSettings;
export interface IVectorDBProviders {
}
export type TVectorDBProvider = TBuiltinVectorDBProvider | keyof IVectorDBProviders;
export declare const TVectorDBProvider: Record<TBuiltinVectorDBProvider, TBuiltinVectorDBProvider>;
export type TVectorDBSettingsFor<T extends TVectorDBProvider> = TAllVectorDBProviderSettings[T];
export type TVectorDBProviderInstances = {
    [K in TVectorDBProvider]: (namespace: string, settings?: TVectorDBSettingsFor<K>, scope?: Scope | AccessCandidate) => VectorDBInstance;
};
