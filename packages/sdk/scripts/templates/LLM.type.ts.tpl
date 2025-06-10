// #region [ Handle extendable LLM Providers ] ================================================
export const BuiltinLLMProviders = {
{{builtinProviders}}
} as const;
// Base provider type
export type TBuiltinLLMProvider = (typeof BuiltinLLMProviders)[keyof typeof BuiltinLLMProviders];

// Extensible interface for custom providers
export interface ILLMProviders {}
// Combined provider type that can be extended
export type TLLMProvider = TBuiltinLLMProvider | keyof ILLMProviders;

// For backward compatibility, export the built-in providers as enum-like object
export const TLLMProvider = BuiltinLLMProviders;
// #endregion 