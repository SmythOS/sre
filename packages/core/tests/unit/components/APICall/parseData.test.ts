import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies to avoid complex setup
vi.mock('../../../../src/helpers/TemplateString.helper', () => ({
    TemplateString: (body: any) => ({
        parseComponentTemplateVarsAsync: () => ({
            asyncResult: Promise.resolve(body)
        }),
        parseTeamKeysAsync: () => ({
            asyncResult: Promise.resolve(body)
        }),
        parse: () => ({
            parse: () => ({
                clean: () => ({
                    result: body
                })
            })
        })
    })
}));

// Mock other dependencies 
vi.mock('../../../../src/helpers/JsonContent.helper', () => ({
    JSONContent: (data: any) => ({ 
        tryParse: () => {
            try {
                return typeof data === 'string' ? JSON.parse(data) : data;
            } catch {
                return null;
            }
        }
    })
}));

import { parseData } from '../../../../src/Components/APICall/parseData';
import { REQUEST_CONTENT_TYPES } from '../../../../src/constants';

// Simple mock agent
const mockAgent = {
    teamId: 'test-team',
    id: 'test-agent'
} as any;

describe('APICall parseData Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('handleNone function - content-type detection', () => {
        it('should detect JSON content-type from headers', async () => {
            const body = '{"test": "value"}';
            const config = {
                data: {
                    contentType: REQUEST_CONTENT_TYPES.none,
                    body
                },
                headers: { 'content-type': 'application/json' }
            };
            
            const result = await parseData({}, config, mockAgent);
            
            // Should delegate to JSON handler and parse the JSON
            expect(result.data).toEqual({ test: 'value' });
        });

        it('should detect JSON content-type from headers (case-insensitive)', async () => {
            const body = '{"test": "value"}';
            const config = {
                data: {
                    contentType: REQUEST_CONTENT_TYPES.none,
                    body
                },
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            };
            
            const result = await parseData({}, config, mockAgent);
            
            // Should delegate to JSON handler
            expect(result.data).toEqual({ test: 'value' });
        });

        it('should use heuristic detection for JSON when no explicit headers', async () => {
            const body = '{"valid": "json", "number": 42}';
            const config = {
                data: {
                    contentType: REQUEST_CONTENT_TYPES.none,
                    body
                },
                headers: {}
            };
            
            const result = await parseData({}, config, mockAgent);
            
            // Should detect JSON and parse it
            expect(result.data).toEqual({ valid: 'json', number: 42 });
        });

        it('should handle text data as fallback', async () => {
            const body = 'plain text content';
            const config = {
                data: {
                    contentType: REQUEST_CONTENT_TYPES.none,
                    body
                },
                headers: {}
            };
            
            const result = await parseData({}, config, mockAgent);
            
            // Should return as-is for plain text
            expect(result.data).toBe(body);
        });

        it('should prioritize explicit headers over heuristic detection', async () => {
            // Data looks like JSON but header says it's text
            const body = '{"looks": "like json"}';
            const config = {
                data: {
                    contentType: REQUEST_CONTENT_TYPES.none,
                    body
                },
                headers: { 'content-type': 'text/plain' }
            };
            
            const result = await parseData({}, config, mockAgent);
            
            // Should respect header and treat as text, not parse as JSON
            expect(result.data).toBe(body);
        });
    });

    describe('integration with existing parseData functionality', () => {
        it('should not interfere with explicit JSON content type', async () => {
            const body = '{"test": "value"}';
            const config = {
                data: {
                    contentType: REQUEST_CONTENT_TYPES.json,
                    body
                },
                headers: {}
            };
            
            const result = await parseData({}, config, mockAgent);
            expect(result.data).toEqual({ test: 'value' });
        });

        it('should not interfere with explicit text content type', async () => {
            const body = 'test data';
            const config = {
                data: {
                    contentType: REQUEST_CONTENT_TYPES.text,
                    body
                },
                headers: {}
            };
            
            const result = await parseData({}, config, mockAgent);
            expect(result.data).toBe(body);
        });
    });
});