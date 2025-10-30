{{imports}}
import { AccessCandidate } from '@smythos/sre';
import { SchedulerInstance } from '../../Scheduler/SchedulerInstance.class';
import { Scope } from '../SDKTypes';

// Define scheduler provider settings mapping
export type TSchedulerProviderSettings = {
    default: {} // Empty config for default provider
{{typeMapping}}
};

// #region [ Handle extendable Scheduler Providers ] ================================================
// Base provider type derived from settings
export type TBuiltinSchedulerProvider = keyof TSchedulerProviderSettings;

// Extensible interface for custom providers
export interface ISchedulerProviders {}
// Combined provider type that can be extended
export type TSchedulerProvider = TBuiltinSchedulerProvider | keyof ISchedulerProviders;

// For backward compatibility, export the built-in providers as enum-like object
export const TSchedulerProvider: Record<TBuiltinSchedulerProvider, TBuiltinSchedulerProvider> = {
    default: 'default',
{{builtinProviders}}
} as const;

// #endregion

// Generic type to get settings for a specific provider
export type TSchedulerSettingsFor<T extends keyof TSchedulerProviderSettings> = TSchedulerProviderSettings[T];

export type TSchedulerProviderInstances = {
    [K in TSchedulerProvider]: (
        settings?: TSchedulerSettingsFor<K>,
        scope?: Scope | AccessCandidate
    ) => SchedulerInstance;
};

