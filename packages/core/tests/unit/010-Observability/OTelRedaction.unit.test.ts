/**
 * Unit tests for OTel sensitive data redaction
 *
 * Tests the redaction logic in OTel.redaction.helper.ts
 * to ensure sensitive data is properly masked in logs and traces.
 */
import { describe, expect, it } from 'vitest';
import { redactSensitiveString, redactData } from '@sre/ObservabilityManager/Telemetry.service/connectors/OTel/OTel.redaction.helper';

/**
 * Mock test keys for testing redaction
 * These are NOT real keys - they are randomly generated base64-like strings
 */
const MOCK_KEY_FULL = 'bW9ja190ZXN0X2tleV9mb3JfdW5pdF90ZXN0aW5nXzEyMzQ1Ng==';
const MOCK_KEY_SHORT = 'bW9ja190ZXN0X2tleV9mb3I=';
const MOCK_KEY_TRUNCATED = 'bW9ja190ZXN0X2tleV9mb3JfdW5pdF90ZXN0aW5n';
const MOCK_KEY_WITH_COLON = 'bW9ja190ZXN0X2tleTphbm90aGVyX3BhcnRfaGVyZQ==';
const MOCK_KEY_PREFIX = 'bW9ja190ZXN0';

describe('OTel Redaction - redactSensitiveString', () => {
    describe('JWT Token Redaction', () => {
        it('should redact full JWT tokens', () => {
            const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
            const input = `Bearer ${jwt}`;
            const result = redactSensitiveString(input);
            expect(result).toBe('Bearer [REDACTED]');
        });

        it('should redact JWT in JSON context', () => {
            const input = '{"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"}';
            const result = redactSensitiveString(input);
            expect(result).toContain('[REDACTED]');
            expect(result).not.toContain('eyJ');
        });
    });

    describe('Regular JSON Redaction', () => {
        it('should redact "key" field values', () => {
            const input = `{"key":"${MOCK_KEY_FULL}"}`;
            const result = redactSensitiveString(input);
            expect(result).toBe('{"key":"[REDACTED]"}');
        });

        it('should redact "password" field values', () => {
            const input = '{"password": "mypassword123"}';
            const result = redactSensitiveString(input);
            expect(result).toBe('{"password": "[REDACTED]"}');
        });

        it('should redact "apikey" field values', () => {
            const input = '{"apikey": "abc1234567890def"}';
            const result = redactSensitiveString(input);
            expect(result).toBe('{"apikey": "[REDACTED]"}');
        });

        it('should redact "token" field values', () => {
            const input = '{"token": "abc123xyz789"}';
            const result = redactSensitiveString(input);
            expect(result).toBe('{"token": "[REDACTED]"}');
        });

        it('should redact "authorization" field values', () => {
            const input = '{"authorization": "Bearer xyz123abc"}';
            const result = redactSensitiveString(input);
            expect(result).toBe('{"authorization": "[REDACTED]"}');
        });

        it('should redact "secret" field values', () => {
            const input = '{"secret": "mysecretvalue123"}';
            const result = redactSensitiveString(input);
            expect(result).toBe('{"secret": "[REDACTED]"}');
        });

        it('should handle multiple sensitive fields', () => {
            const input = '{"key":"secret123","password":"pass456","trigger":"test"}';
            const result = redactSensitiveString(input);
            expect(result).toBe('{"key":"[REDACTED]","password":"[REDACTED]","trigger":"test"}');
        });

        it('should preserve non-sensitive fields', () => {
            const input = '{"trigger":"test run","name":"MyAgent","status":"success"}';
            const result = redactSensitiveString(input);
            expect(result).toBe('{"trigger":"test run","name":"MyAgent","status":"success"}');
        });
    });

    describe('Truncated JSON Redaction', () => {
        it('should redact truncated "key" values (no closing quote)', () => {
            const input = `{"key":"${MOCK_KEY_TRUNCATED}`;
            const result = redactSensitiveString(input);
            expect(result).toBe('{"key":"[REDACTED]');
        });

        it('should redact truncated "token" values', () => {
            const input = '{"token":"abcdefghijklmnopqrstuvwxyz123456789';
            const result = redactSensitiveString(input);
            expect(result).toBe('{"token":"[REDACTED]');
        });
    });

    describe('Escaped JSON Redaction (embedded in strings)', () => {
        it('should redact escaped "key" field values', () => {
            const input = `debug: {\\"key\\": \\"${MOCK_KEY_SHORT}\\"}`;
            const result = redactSensitiveString(input);
            expect(result).toBe('debug: {\\"key\\": \\"[REDACTED]\\"}');
        });

        it('should redact escaped "password" field values', () => {
            const input = 'log: {\\"password\\": \\"secret123\\"}';
            const result = redactSensitiveString(input);
            expect(result).toBe('log: {\\"password\\": \\"[REDACTED]\\"}');
        });

        it('should redact truncated escaped JSON values', () => {
            const input = `Input Variables: \\n{\\n \\"key\\": \\"${MOCK_KEY_TRUNCATED}`;
            const result = redactSensitiveString(input);
            expect(result).toContain('\\"key\\": \\"[REDACTED]');
        });

        it('should handle real-world debug output format', () => {
            const input = `{"_debug":"debug: === Serverless Code Log ===\\ndebug: \\nInput Variables: \\n{\\n \\"key\\": \\"${MOCK_KEY_WITH_COLON}`;
            const result = redactSensitiveString(input);
            expect(result).toContain('\\"key\\": \\"[REDACTED]');
            expect(result).not.toContain(MOCK_KEY_PREFIX);
        });
    });

    describe('Word-based Redaction (plain text)', () => {
        it('should redact password=value patterns', () => {
            const input = 'Config: password=mysecretpass123';
            const result = redactSensitiveString(input);
            expect(result).toBe('Config: password=[REDACTED]');
        });

        it('should redact API key patterns in key=value format', () => {
            const input = 'apikey=sk-1234567890abcdef';
            const result = redactSensitiveString(input);
            expect(result).toContain('[REDACTED]');
        });

        it('should redact sk- prefix in JSON', () => {
            const input = '{"apikey": "sk-1234567890abcdef"}';
            const result = redactSensitiveString(input);
            expect(result).toBe('{"apikey": "[REDACTED]"}');
        });

        it('should redact AKIA (AWS) patterns', () => {
            const input = 'AWS Key: AKIAIOSFODNN7EXAMPLE';
            const result = redactSensitiveString(input);
            expect(result).toContain('[REDACTED]');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty strings', () => {
            expect(redactSensitiveString('')).toBe('');
        });

        it('should handle strings with no sensitive data', () => {
            const input = 'Hello World! This is a normal message.';
            expect(redactSensitiveString(input)).toBe(input);
        });

        it('should be case-insensitive for sensitive words', () => {
            const input = '{"KEY":"secret123","Password":"pass456"}';
            const result = redactSensitiveString(input);
            expect(result).toBe('{"KEY":"[REDACTED]","Password":"[REDACTED]"}');
        });
    });
});

describe('OTel Redaction - redactData', () => {
    describe('Object Key-based Redaction', () => {
        it('should redact values for sensitive keys', () => {
            const input = { key: MOCK_KEY_FULL, trigger: 'test run' };
            const result = redactData(input);
            expect(result).toEqual({ key: '[REDACTED]', trigger: 'test run' });
        });

        it('should redact "password" field', () => {
            const input = { password: 'supersecret', username: 'john' };
            const result = redactData(input);
            expect(result).toEqual({ password: '[REDACTED]', username: 'john' });
        });

        it('should redact nested sensitive fields', () => {
            const input = {
                config: {
                    apiKey: 'sk-1234',
                    timeout: 5000,
                },
                name: 'test',
            };
            const result = redactData(input);
            expect(result).toEqual({
                config: {
                    apiKey: '[REDACTED]',
                    timeout: 5000,
                },
                name: 'test',
            });
        });

        it('should handle arrays with sensitive data', () => {
            const input = [
                { key: 'secret1', name: 'item1' },
                { key: 'secret2', name: 'item2' },
            ];
            const result = redactData(input);
            expect(result).toEqual([
                { key: '[REDACTED]', name: 'item1' },
                { key: '[REDACTED]', name: 'item2' },
            ]);
        });
    });

    describe('String Value Content Redaction', () => {
        it('should redact sensitive patterns in string values', () => {
            const input = {
                message: 'Using token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
            };
            const result = redactData(input);
            expect(result.message).toContain('[REDACTED]');
            expect(result.message).not.toContain('eyJhbG');
        });
    });

    describe('Edge Cases', () => {
        it('should handle null', () => {
            expect(redactData(null)).toBe(null);
        });

        it('should handle undefined', () => {
            expect(redactData(undefined)).toBe(undefined);
        });

        it('should handle numbers', () => {
            expect(redactData(12345)).toBe(12345);
        });

        it('should handle booleans', () => {
            expect(redactData(true)).toBe(true);
        });
    });
});

describe('OTel Redaction - Real-world Scenarios', () => {
    it('should redact cmp.input with vault key', () => {
        const input = { trigger: 'test run', key: MOCK_KEY_WITH_COLON };
        const result = redactData(input);
        expect(result).toEqual({ trigger: 'test run', key: '[REDACTED]' });
    });

    it('should redact agent.output with nested state', () => {
        const input = {
            state: [
                {
                    id: 'CML80PHI7JE',
                    name: 'ServerlessCode',
                    result: {
                        Output: '2026-02-04T17:48:02+00:00',
                        _debug: `debug: Input Variables: {"key": "${MOCK_KEY_SHORT}"}`,
                    },
                },
            ],
            sessionResult: true,
        };
        const result = redactData(input);

        // The _debug string should have its embedded JSON redacted
        const debugValue = (result.state as Array<{ result: { _debug: string } }>)[0].result._debug;
        expect(debugValue).toContain('[REDACTED]');
        expect(debugValue).not.toContain(MOCK_KEY_PREFIX);
    });

    it('should redact output.preview with embedded debug', () => {
        const input = `{"Output":"2026-02-05T14:37:07+00:00","_debug":"debug: === Serverless Code Log ===\\ndebug: \\nInput Variables: \\n{\\n \\"key\\": \\"${MOCK_KEY_WITH_COLON}`;
        const result = redactSensitiveString(input);
        expect(result).toContain('\\"key\\": \\"[REDACTED]');
        expect(result).not.toContain(MOCK_KEY_PREFIX);
    });
});
