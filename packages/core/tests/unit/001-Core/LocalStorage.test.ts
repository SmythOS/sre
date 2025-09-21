import { LocalStorage } from '@sre/IO/Storage.service/connectors/LocalStorage.class';
import { describe, expect, it } from 'vitest';

describe('LocalStorage Tests', () => {
    it('should initialize with undefined folder without crashing', () => {
        // Test with undefined settings
        expect(() => {
            new LocalStorage();
        }).not.toThrow();

        // Test with empty settings object
        expect(() => {
            new LocalStorage({});
        }).not.toThrow();

        // Test with explicitly undefined folder
        expect(() => {
            new LocalStorage({ folder: undefined });
        }).not.toThrow();
    });

    it('should initialize with valid folder path', () => {
        const tempDir = require('os').tmpdir();
        
        expect(() => {
            new LocalStorage({ folder: tempDir });
        }).not.toThrow();
    });

    it('should handle non-existent folder gracefully', () => {
        // This should not crash but may log warnings as designed
        expect(() => {
            new LocalStorage({ folder: '/non/existent/path/that/should/not/exist' });
        }).not.toThrow();
    });
});
