// prettier-ignore-file
/**
 * Shared integration test helpers.
 *
 * Credential resolution order (same as production):
 *   1. Environment variables (.env) — OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.
 *   2. Vault file (~/.smyth/vault.json) — { "default": { "openai": "sk-..." } }
 *
 * To run integration tests:
 *   ENABLE_INTEGRATION_TESTS=true pnpm test:integration
 */

import { SRE } from '@smythos/sre';

let _sreInitialized = false;

/**
 * Initialize SRE once per process. Safe to call multiple times.
 * Uses default local connectors (LocalStorage, RAM cache, RAMVec, LocalScheduler).
 */
export async function initSRE(extraConfig: Record<string, any> = {}) {
    if (!_sreInitialized) {
        SRE.init({
            ...extraConfig,
        });
        await SRE.ready();
        _sreInitialized = true;
    }
}

/** Generate a unique namespace/ID to avoid test collisions. */
export function unique(prefix = 'test') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Check if a given environment variable or vault key is available.
 * Use this to conditionally skip tests that need specific API keys.
 */
export function hasEnvKey(envVar: string): boolean {
    return !!process.env[envVar];
}

/**
 * Provider availability checks.
 * Tests use describe.skipIf(!HAS_OPENAI) to skip gracefully.
 */
export const HAS_OPENAI      = hasEnvKey('OPENAI_API_KEY');
export const HAS_ANTHROPIC   = hasEnvKey('ANTHROPIC_API_KEY');
export const HAS_GOOGLE_AI   = hasEnvKey('GOOGLE_AI_API_KEY');
export const HAS_GROQ        = hasEnvKey('GROQ_API_KEY');
export const HAS_XAI         = hasEnvKey('XAI_API_KEY');
export const HAS_TOGETHER_AI = hasEnvKey('TOGETHER_AI_API_KEY');
export const HAS_PERPLEXITY  = hasEnvKey('PERPLEXITY_API_KEY');
export const HAS_DEEPSEEK    = hasEnvKey('DEEPSEEK_API_KEY');

// Non-LLM services
export const HAS_PINECONE    = hasEnvKey('PINECONE_API_KEY');
export const HAS_REDIS       = hasEnvKey('REDIS_URL');
export const HAS_MILVUS      = hasEnvKey('MILVUS_ADDRESS');
export const HAS_AWS         = hasEnvKey('AWS_ACCESS_KEY_ID') && hasEnvKey('AWS_SECRET_ACCESS_KEY');
export const HAS_AWS_SECRETS = HAS_AWS && hasEnvKey('AWS_REGION');
export const HAS_S3_STORAGE  = HAS_AWS && hasEnvKey('S3_BUCKET_NAME');
export const HAS_S3_CACHE    = HAS_AWS && hasEnvKey('S3_CACHE_BUCKET_NAME');

/** True when ANY LLM provider is available (for tests that just need "some" LLM). */
export const HAS_ANY_LLM = HAS_OPENAI || HAS_ANTHROPIC || HAS_GOOGLE_AI || HAS_GROQ;

/** True when an embeddings provider is available (VectorDB requires this). */
export const HAS_EMBEDDINGS = HAS_OPENAI || HAS_GOOGLE_AI;

/** Returns the first available LLM provider config for generic tests. */
export function getAnyLLMConfig(): { provider: string; model: string } | null {
    if (HAS_OPENAI)    return { provider: 'OpenAI',    model: 'gpt-4o-mini' };
    if (HAS_ANTHROPIC) return { provider: 'Anthropic', model: 'claude-sonnet-4-20250514' };
    if (HAS_GOOGLE_AI) return { provider: 'GoogleAI',  model: 'gemini-2.0-flash' };
    if (HAS_GROQ)      return { provider: 'Groq',      model: 'llama-3.1-8b-instant' };
    return null;
}
