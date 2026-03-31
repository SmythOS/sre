import { describe, expect, it } from 'vitest';
import { ImageGenerator } from '@sre/Components/ImageGenerator.class';

/**
 * Unit tests for the ImageGenerator component's schema validation
 * and Google AI config defaults (aspectRatio, resolution, personGeneration).
 */

// Instantiate to access the protected configSchema via bracket notation
const imageGen = new ImageGenerator();
const configSchema = (imageGen as any).configSchema;

describe('ImageGenerator Schema Validation', () => {
    describe('aspectRatio', () => {
        const VALID_ASPECT_RATIOS = ['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9'];
        const INVALID_ASPECT_RATIOS = ['1:3', '5:5', '10:16', '2:1', 'square'];

        it.each(VALID_ASPECT_RATIOS)('should accept valid aspect ratio: %s', (ratio) => {
            const { error } = configSchema.validate({ model: 'test-model', aspectRatio: ratio }, { allowUnknown: true });
            expect(error).toBeUndefined();
        });

        it.each(INVALID_ASPECT_RATIOS)('should reject invalid aspect ratio: %s', (ratio) => {
            const { error } = configSchema.validate({ model: 'test-model', aspectRatio: ratio }, { allowUnknown: true });
            expect(error).toBeDefined();
        });

        it('should accept empty string for aspectRatio', () => {
            const { error } = configSchema.validate({ model: 'test-model', aspectRatio: '' }, { allowUnknown: true });
            expect(error).toBeUndefined();
        });

        it('should accept undefined (optional) aspectRatio', () => {
            const { error } = configSchema.validate({ model: 'test-model' }, { allowUnknown: true });
            expect(error).toBeUndefined();
        });
    });

    describe('resolution', () => {
        const VALID_RESOLUTIONS = ['0.5K', '1K', '2K', '4K'];
        const INVALID_RESOLUTIONS = ['0.25K', '3K', '8K', 'HD', '1080p'];

        it.each(VALID_RESOLUTIONS)('should accept valid resolution: %s', (res) => {
            const { error } = configSchema.validate({ model: 'test-model', resolution: res }, { allowUnknown: true });
            expect(error).toBeUndefined();
        });

        it.each(INVALID_RESOLUTIONS)('should reject invalid resolution: %s', (res) => {
            const { error } = configSchema.validate({ model: 'test-model', resolution: res }, { allowUnknown: true });
            expect(error).toBeDefined();
        });

        it('should accept empty string for resolution', () => {
            const { error } = configSchema.validate({ model: 'test-model', resolution: '' }, { allowUnknown: true });
            expect(error).toBeUndefined();
        });

        it('should accept undefined (optional) resolution', () => {
            const { error } = configSchema.validate({ model: 'test-model' }, { allowUnknown: true });
            expect(error).toBeUndefined();
        });
    });

    describe('personGeneration', () => {
        const VALID_OPTIONS = ['dont_allow', 'allow_adult', 'allow_all'];
        const INVALID_OPTIONS = ['block', 'allow', 'yes', 'no'];

        it.each(VALID_OPTIONS)('should accept valid personGeneration: %s', (opt) => {
            const { error } = configSchema.validate({ model: 'test-model', personGeneration: opt }, { allowUnknown: true });
            expect(error).toBeUndefined();
        });

        it.each(INVALID_OPTIONS)('should reject invalid personGeneration: %s', (opt) => {
            const { error } = configSchema.validate({ model: 'test-model', personGeneration: opt }, { allowUnknown: true });
            expect(error).toBeDefined();
        });

        it('should accept empty string for personGeneration', () => {
            const { error } = configSchema.validate({ model: 'test-model', personGeneration: '' }, { allowUnknown: true });
            expect(error).toBeUndefined();
        });
    });

    describe('combined Google AI fields', () => {
        it('should validate all Google AI fields together', () => {
            const { error } = configSchema.validate(
                {
                    model: 'test-model',
                    aspectRatio: '16:9',
                    personGeneration: 'dont_allow',
                    resolution: '2K',
                },
                { allowUnknown: true },
            );
            expect(error).toBeUndefined();
        });

        it('should validate Google AI fields alongside other provider fields', () => {
            const { error } = configSchema.validate(
                {
                    model: 'test-model',
                    aspectRatio: '4:3',
                    resolution: '1K',
                    personGeneration: 'allow_adult',
                    size: '1024x1024',
                    quality: 'standard',
                },
                { allowUnknown: true },
            );
            expect(error).toBeUndefined();
        });
    });
});
