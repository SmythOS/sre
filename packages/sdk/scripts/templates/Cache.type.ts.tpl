{{imports}}
import { AccessCandidate } from '@smythos/sre';
import { CacheInstance } from '../../Cache/CacheInstance.class';
import { Scope } from '../SDKTypes';

// Define cache provider settings mapping
export type TCacheProviderSettings = {
    default: {} // Empty config for default provider
{{typeMapping}}
};

// #region [ Handle extendable Cache Providers ] ================================================
// Base provider type derived from settings
export type TBuiltinCacheProvider = keyof TCacheProviderSettings;

// Extensible interface for custom providers
export interface ICacheProviders {}
// Combined provider type that can be extended
export type TCacheProvider = TBuiltinCacheProvider | keyof ICacheProviders;

// For backward compatibility, export the built-in providers as enum-like object
export const TCacheProvider: Record<TBuiltinCacheProvider, TBuiltinCacheProvider> = {
    default: 'default',
{{builtinProviders}}
} as const;

// #endregion

// Generic type to get settings for a specific provider
export type TCacheSettingsFor<T extends keyof TCacheProviderSettings> = TCacheProviderSettings[T];

export type TCacheProviderInstances = {
    [K in TCacheProvider]: (
        settings?: TCacheSettingsFor<K>,
        scope?: Scope | AccessCandidate
    ) => CacheInstance;
};
