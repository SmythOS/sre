// prettier-ignore-file
import { describe, it, expect, vi } from 'vitest';

vi.mock('@smythos/sre', async () => {
    return {
        TLLMProvider: { OpenAI: 'OpenAI', Anthropic: 'Anthropic' },
        DEFAULT_TEAM_ID: 'default',
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
    };
});

import { adaptModelParams } from '../../../src/LLM/utils';

// ---------------------------------------------------------------------------
// adaptModelParams()
// ---------------------------------------------------------------------------
describe('adaptModelParams()', () => {
    it('returns an object with model property', () => {
        const result = adaptModelParams({ model: 'gpt-4o' }, 'OpenAI' as any);
        expect(result).toHaveProperty('model');
        expect(result.model).toBeDefined();
    });

    it('sets provider from fallback when not in settings', () => {
        const result = adaptModelParams({ model: 'gpt-4o' }, 'OpenAI' as any);
        expect(result.model.provider).toBe('OpenAI');
    });

    it('preserves explicit provider over fallback', () => {
        const result = adaptModelParams({ model: 'gpt-4o', provider: 'Anthropic' as any }, 'OpenAI' as any);
        expect(result.model.provider).toBe('Anthropic');
    });

    it('extracts temperature and maxTokens into params', () => {
        const result = adaptModelParams({
            model: 'gpt-4o',
            temperature: 0.7,
            maxTokens: 100,
        }, 'OpenAI' as any);
        expect(result.model.params.temperature).toBe(0.7);
        expect(result.model.params.maxTokens).toBe(100);
    });

    it('sets modelId and model as string on output', () => {
        const result = adaptModelParams({ model: 'gpt-4o' }, 'OpenAI' as any);
        expect(result.model.modelId).toBe('gpt-4o');
        expect(result.model.model).toBe('gpt-4o');
    });

    it('adds sdk to tags', () => {
        const result = adaptModelParams({ model: 'gpt-4o' }, 'OpenAI' as any);
        expect(result.model.tags).toContain('sdk');
    });

    it('merges default settings tags', () => {
        const defaults: any = { tags: ['builtin'], tokens: 128000 };
        const result = adaptModelParams({ model: 'gpt-4o' }, 'OpenAI' as any, defaults);
        expect(result.model.tags).toContain('sdk');
        expect(result.model.tags).toContain('builtin');
    });

    it('uses inputTokens/outputTokens over defaults', () => {
        const defaults: any = { tokens: 128000, completionTokens: 8192 };
        const result = adaptModelParams({
            model: 'gpt-4o',
            inputTokens: 64000,
            outputTokens: 4096,
        }, 'OpenAI' as any, defaults);
        expect(result.model.tokens).toBe(64000);
        expect(result.model.completionTokens).toBe(4096);
    });

    it('falls back to default tokens when not specified', () => {
        const defaults: any = { tokens: 128000, completionTokens: 8192, keyOptions: { tokens: 128000, completionTokens: 8192 } };
        const result = adaptModelParams({ model: 'gpt-4o' }, 'OpenAI' as any, defaults);
        expect(result.model.tokens).toBe(128000);
    });

    it('extracts apiKey into credentials and removes from params', () => {
        const result = adaptModelParams({
            model: 'gpt-4o',
            apiKey: 'sk-test',
        }, 'OpenAI' as any);
        expect(result.model.credentials).toEqual({ apiKey: 'sk-test' });
        expect(result.model.params.apiKey).toBeUndefined();
    });

    it('defaults credentials to vault when not provided', () => {
        const result = adaptModelParams({ model: 'gpt-4o' }, 'OpenAI' as any);
        expect(result.model.credentials).toEqual(['vault']);
    });

    it('preserves explicit credentials', () => {
        const result = adaptModelParams({
            model: 'gpt-4o',
            credentials: ['internal'] as any,
        }, 'OpenAI' as any);
        expect(result.model.credentials).toEqual(['internal']);
    });

    it('merges default features', () => {
        const defaults: any = { features: ['vision'] };
        const result = adaptModelParams({
            model: 'gpt-4o',
            features: ['tools'] as any,
        }, 'OpenAI' as any, defaults);
        expect(result.model.features).toContain('tools');
        expect(result.model.features).toContain('vision');
    });

    it('handles behavior in params', () => {
        const result = adaptModelParams({
            model: 'gpt-4o',
            behavior: 'Be concise',
        }, 'OpenAI' as any);
        expect(result.model.params.behavior).toBe('Be concise');
    });

    it('handles baseURL param', () => {
        const result = adaptModelParams({
            model: 'gpt-4o',
            baseURL: 'https://custom.api.com',
        }, 'OpenAI' as any);
        expect(result.model.baseURL).toBe('https://custom.api.com');
    });
});
