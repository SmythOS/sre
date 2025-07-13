import { LocalStorageConfig } from '@smythos/sre';
import { S3Config } from '@smythos/sre';
import { AccessCandidate } from '@smythos/sre';
import { StorageInstance } from '../../Storage/StorageInstance.class';
import { Scope } from '../SDKTypes';
export type TStorageProviderSettings = {
    LocalStorage: LocalStorageConfig;
    S3: S3Config;
};
export type TBuiltinStorageProvider = keyof TStorageProviderSettings;
export interface IStorageProviders {
}
export type TStorageProvider = TBuiltinStorageProvider | keyof IStorageProviders;
export declare const TStorageProvider: Record<TBuiltinStorageProvider, TBuiltinStorageProvider>;
export type TStorageSettingsFor<T extends keyof TStorageProviderSettings> = TStorageProviderSettings[T];
export type TStorageProviderInstances = {
    [K in TStorageProvider]: (settings?: TStorageSettingsFor<K>, scope?: Scope | AccessCandidate) => StorageInstance;
};
