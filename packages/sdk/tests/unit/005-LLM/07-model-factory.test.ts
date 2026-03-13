// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@smythos/sre', async () => {
    return {
        TLLMProvider: { OpenAI: 'OpenAI', Anthropic: 'Anthropic', Google: 'Google' },
        DEFAULT_TEAM_ID: 'default',
        AccessCandidate: {
            team: (id: string) => ({ type: 'team', id }),
        },
        ConnectorService: {
            getModelsProviderConnector() { return null; },
            getLLMConnector() { return null; },
        },
        SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
    };
});

import { Model, findClosestModelInfo } from '../../../src/LLM/Model';

// ---------------------------------------------------------------------------
// findClosestModelInfo()
// ---------------------------------------------------------------------------
describe('findClosestModelInfo()', () => {
    const models = {
        'gpt-4o': {
            tokens: 128000,
            completionTokens: 8192,
            keyOptions: {},
        },
        'gpt-4o-mini': {
            tokens: 128000,
            completionTokens: 4096,
            keyOptions: {},
        },
        'claude-3-sonnet': {
            tokens: 200000,
            completionTokens: 8192,
            alias: 'claude-3-sonnet',
            keyOptions: {},
        },
        'gpt-3.5-turbo': {
            tokens: 16385,
            completionTokens: 4096,
            keyOptions: {},
        },
    };

    it('returns exact match when model ID exists', () => {
        const result = findClosestModelInfo(models, 'gpt-4o');
        expect(result).toBeDefined();
        expect(result.modelEntryName).toBe('gpt-4o');
        expect(result.tokens).toBe(128000);
    });

    it('resolves alias to the target model', () => {
        const modelsWithAlias: any = {
            'gpt-4': { alias: 'gpt-4o', tokens: 0 },
            'gpt-4o': { tokens: 128000, completionTokens: 8192 },
        };
        const result = findClosestModelInfo(modelsWithAlias, 'gpt-4');
        expect(result.modelEntryName).toBe('gpt-4o');
        expect(result.tokens).toBe(128000);
    });

    it('returns fuzzy match when exact match not found', () => {
        const result = findClosestModelInfo(models, 'gpt-4');
        expect(result).toBeDefined();
        // fuzzy match should find something close to 'gpt-4'
        expect(result.modelId).toBe('gpt-4');
        expect(result.enabled).toBe(true);
        expect(result.credentials).toEqual(['internal', 'vault']);
    });

    it('caches fuzzy match in the models object', () => {
        const testModels: any = {
            'gpt-4o': { tokens: 128000 },
        };
        findClosestModelInfo(testModels, 'gpt-4');
        expect(testModels['gpt-4']).toBeDefined();
        expect(testModels['gpt-4'].modelId).toBe('gpt-4');
    });

    it('returns null when no match is possible', () => {
        const result = findClosestModelInfo({}, 'nonexistent');
        expect(result).toBeNull();
    });

    it('returns null when models is empty object', () => {
        expect(findClosestModelInfo({}, 'gpt-4')).toBeNull();
    });

    it('clones model info for fuzzy matches (no mutation of source)', () => {
        const testModels: any = {
            'gpt-4o': { tokens: 128000, nested: { value: 1 } },
        };
        const result = findClosestModelInfo(testModels, 'gpt-4');
        result.tokens = 999;
        // original should not be affected
        expect(testModels['gpt-4o'].tokens).toBe(128000);
    });

    it('fuzzy match sets modelEntryName to the searched ID', () => {
        const result = findClosestModelInfo(models, 'gpt-4o-min');
        expect(result).toBeDefined();
        expect(result.modelEntryName).toBe('gpt-4o-min');
    });
});

// ---------------------------------------------------------------------------
// Model factory
// ---------------------------------------------------------------------------
describe('Model factory', () => {
    it('has factory methods for each provider', () => {
        expect(typeof Model.OpenAI).toBe('function');
        expect(typeof Model.Anthropic).toBe('function');
        expect(typeof Model.Google).toBe('function');
    });

    it('creates model object from string ID', () => {
        const result = Model.OpenAI('gpt-4o');
        expect(result).toBeDefined();
        expect(result.modelId).toBe('gpt-4o');
        expect(result.provider).toBe('OpenAI');
    });

    it('creates model object from params with model field', () => {
        const result = Model.OpenAI({ model: 'gpt-4o', temperature: 0.7 });
        expect(result).toBeDefined();
        expect(result.modelId).toBe('gpt-4o');
    });

    it('merges additional params when using string + params signature', () => {
        const result = Model.OpenAI('gpt-4o', { temperature: 0.5, maxTokens: 100 });
        expect(result).toBeDefined();
        expect(result.params.temperature).toBe(0.5);
        expect(result.params.maxTokens).toBe(100);
    });

    it('sets tags to include sdk', () => {
        const result = Model.OpenAI('gpt-4o');
        expect(result.tags).toContain('sdk');
    });

    it('defaults credentials to vault when not specified', () => {
        const result = Model.OpenAI('gpt-4o');
        expect(result.credentials).toEqual(['vault']);
    });

    it('extracts apiKey into credentials object', () => {
        const result = Model.OpenAI({ model: 'gpt-4o', apiKey: 'sk-test123' });
        expect(result.credentials).toEqual({ apiKey: 'sk-test123' });
        expect(result.params.apiKey).toBeUndefined();
    });
});
