{{imports}}
import { VectorDBInstance } from '@sre/sdk/VectorDB.class';

// Define VectorDB provider settings mapping
export type TVectorDBProviderSettings = {
{{typeMapping}}
};

// #region [ Handle extendable VectorDB Providers ] ================================================
// Base provider type derived from settings
export type TBuiltinVectorDBProvider = keyof TVectorDBProviderSettings;

// Extensible interface for custom providers
export interface IVectorDBProviders {}
// Combined provider type that can be extended
export type TVectorDBProvider = TBuiltinVectorDBProvider | keyof IVectorDBProviders;

// For backward compatibility, export the built-in providers as enum-like object
export const TVectorDBProvider: Record<TBuiltinVectorDBProvider, TBuiltinVectorDBProvider> = {
{{builtinProviders}}
} as const;

// #endregion

// Generic type to get settings for a specific provider
export type TVectorDBSettingsFor<T extends keyof TVectorDBProviderSettings> = TVectorDBProviderSettings[T];

export type TVectorDBProviderInstances = {
    [K in TVectorDBProvider]: (namespace:string, settings?: K extends keyof TVectorDBProviderSettings ? TVectorDBSettingsFor<K> : any) => VectorDBInstance;
}; 