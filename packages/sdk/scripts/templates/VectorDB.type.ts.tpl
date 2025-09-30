{{imports}}
import { AccessCandidate } from '@smythos/sre';
import { VectorDBInstance } from '../../VectorDB/VectorDBInstance.class';
import { Scope } from '../SDKTypes';

// Define VectorDB provider settings mapping
export type TVectorDBProviderSettings = {
    default: {} // Empty config for default provider
{{typeMapping}}
};

export type TAllVectorDBProviderSettings = TVectorDBProviderSettings & IVectorDBProviders;

// #region [ Handle extendable VectorDB Providers ] ================================================
// Base provider type derived from settings
export type TBuiltinVectorDBProvider = keyof TVectorDBProviderSettings;

// Extensible interface for custom providers
export interface IVectorDBProviders {}
// Combined provider type that can be extended
export type TVectorDBProvider = TBuiltinVectorDBProvider | keyof IVectorDBProviders;

// For backward compatibility, export the built-in providers as enum-like object
export const TVectorDBProvider: Record<TBuiltinVectorDBProvider, TBuiltinVectorDBProvider> = {
    default: 'default',
{{builtinProviders}}
} as const;

// #endregion


// Generic type to get settings for a specific provider
export type TVectorDBSettingsFor<T extends TVectorDBProvider> = TAllVectorDBProviderSettings[T];

export type TVectorDBProviderInstances = {
    [K in TVectorDBProvider]: (namespace: string, settings?: TVectorDBSettingsFor<K>, scope?: Scope | AccessCandidate) => VectorDBInstance;
};
