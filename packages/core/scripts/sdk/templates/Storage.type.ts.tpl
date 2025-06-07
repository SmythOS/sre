{{imports}}
import { StorageInstance } from '@sre/sdk/Storage.class';

// Define storage provider settings mapping
export type TStorageProviderSettings = {
{{typeMapping}}
};

// #region [ Handle extendable Storage Providers ] ================================================
// Base provider type derived from settings
export type TBuiltinStorageProvider = keyof TStorageProviderSettings;

// Extensible interface for custom providers
export interface IStorageProviders {}
// Combined provider type that can be extended
export type TStorageProvider = TBuiltinStorageProvider | keyof IStorageProviders;

// For backward compatibility, export the built-in providers as enum-like object
export const TStorageProvider: Record<TBuiltinStorageProvider, TBuiltinStorageProvider> = {
{{builtinProviders}}
} as const;

// #endregion

// Generic type to get settings for a specific provider
export type TStorageSettingsFor<T extends keyof TStorageProviderSettings> = TStorageProviderSettings[T];

export type TStorageProviderInstances = {
    [K in TStorageProvider]: (settings?: K extends keyof TStorageProviderSettings ? TStorageSettingsFor<K> : any) => StorageInstance;
};
