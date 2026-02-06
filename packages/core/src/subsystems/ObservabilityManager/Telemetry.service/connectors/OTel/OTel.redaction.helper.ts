/**
 * OTel Redaction Helper
 *
 * Provides sensitive data redaction functions for OpenTelemetry logs and traces.
 * Adapted from Log.helper.ts redactLogMessage() function with enhancements for OTel.
 *
 * Key features:
 * - JSON-aware redaction: handles "key":"value" patterns
 * - Escaped JSON redaction: handles \"key\":\"value\" patterns in embedded strings
 * - Truncated value support: handles preview strings without closing quotes
 * - Key-based redaction: redacts values based on sensitive key names
 * - JWT token redaction: full token redaction
 * - Header redaction: full redaction for auth headers
 */

/**
 * Sensitive words for content-based redaction
 * Used to identify sensitive data in both key names and value content
 */
export const SENSITIVE_WORDS = [
    // Common sensitive field names
    'password',
    'eyJ', // JWT token prefix (also caught by JWT regex, but catches partial matches)
    'token',
    'email',
    'secret',
    'key',
    'apikey',
    'api_key',
    'auth',
    'credential',
    // Additional patterns
    'bearer',
    'private',
    'AKIA', // AWS access key ID prefix
    'authorization',
    // API key prefixes
    'sk-', // OpenAI secret keys
    'sk_', // Stripe secret keys
    'pk_', // Stripe publishable keys
    'xox', // Slack tokens (xoxb-, xoxp-, xoxa-, xoxr-)
    'ghp_', // GitHub personal access tokens
    'gho_', // GitHub OAuth tokens
    'npm_', // npm tokens
];

/**
 * Sensitive header names that should have their values fully redacted
 */
export const SENSITIVE_HEADERS = ['authorization', 'x-api-key', 'api-key', 'x-auth-token', 'x-access-token', 'cookie', 'set-cookie'];

/**
 * Redact sensitive data from a string value
 * Applies multiple regex patterns to catch sensitive data in various formats.
 *
 * @param value - The string to redact
 * @returns The redacted string with sensitive data replaced by [REDACTED]
 */
export function redactSensitiveString(value: string): string {
    if (typeof value !== 'string' || value.length === 0) {
        return value;
    }

    let redacted = value;

    // 1. Full JWT token redaction (entire token, not just 30 chars)
    // JWT format: header.payload.signature (all base64url encoded)
    const jwtPattern = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
    redacted = redacted.replace(jwtPattern, '[REDACTED]');

    // 2. JSON-aware redaction: "key":"value" or "key": "value" patterns
    // This handles JSON objects where sensitive keys have string values
    for (const sensitiveWord of SENSITIVE_WORDS) {
        // Match "sensitiveWord" (with quotes) followed by : and a quoted value
        const jsonKeyPattern = new RegExp(`("${sensitiveWord}"\\s*:\\s*)"([^"]*)"`, 'gmi');
        redacted = redacted.replace(jsonKeyPattern, '$1"[REDACTED]"');

        // Match "sensitiveWord" (with quotes) followed by : and a non-quoted value until comma or }
        // Exclude whitespace to avoid matching spaces after already-redacted quoted values
        const jsonKeyUnquotedPattern = new RegExp(`("${sensitiveWord}"\\s*:\\s*)([^",}\\]\\s]+)`, 'gmi');
        redacted = redacted.replace(jsonKeyUnquotedPattern, '$1[REDACTED]');

        // Handle truncated values where the closing quote is missing (common in previews)
        // Pattern: "key": "value (no closing quote, matches base64/API-key-like strings)
        const jsonTruncatedPattern = new RegExp(`("${sensitiveWord}"\\s*:\\s*)"([A-Za-z0-9+/=_-]{8,})`, 'gmi');
        redacted = redacted.replace(jsonTruncatedPattern, '$1"[REDACTED]');
    }

    // 3. Escaped JSON redaction: \"key\":\"value\" patterns (JSON embedded in strings)
    // This handles nested JSON where quotes are escaped
    for (const sensitiveWord of SENSITIVE_WORDS) {
        // Match \"sensitiveWord\" (escaped quotes) followed by : and escaped quoted value
        // Pattern: \"key\": \"value\" or \"key\":\"value\"
        const escapedJsonPattern = new RegExp(`(\\\\"${sensitiveWord}\\\\"\\s*:\\s*)\\\\"([^\\\\]*?)\\\\"`, 'gmi');
        redacted = redacted.replace(escapedJsonPattern, '$1\\"[REDACTED]\\"');

        // Also handle truncated values where the closing quote is missing (common in previews)
        // Pattern: \"key\": \"value (no closing quote, matches to end of string or next key)
        const escapedJsonTruncatedPattern = new RegExp(`(\\\\"${sensitiveWord}\\\\"\\s*:\\s*)\\\\"([A-Za-z0-9+/=_-]{8,})`, 'gmi');
        redacted = redacted.replace(escapedJsonTruncatedPattern, '$1\\"[REDACTED]');
    }

    // 4. Word-based redaction for non-JSON text (more conservative - limit to 50 chars)
    // Only applies to patterns not already caught by JSON patterns
    for (const sensitiveWord of SENSITIVE_WORDS) {
        // Match sensitive word followed by separator and up to 50 chars, stopping at common delimiters
        const regex = new RegExp(`(${sensitiveWord})(\\s*[=:]\\s*)([^\\s,;\\n"'\\]\\}]{1,50})`, 'gmi');
        redacted = redacted.replace(regex, '$1$2[REDACTED]');
    }

    return redacted;
}

/**
 * Redact sensitive HTTP headers
 * Full value redaction for known auth headers, string redaction for others.
 *
 * @param headers - The headers object or string to redact
 * @returns The redacted headers with sensitive values replaced
 */
export function redactHeaders(headers: Record<string, unknown> | string | undefined | null): Record<string, unknown> | string | undefined | null {
    if (headers === null || headers === undefined) {
        return headers;
    }

    // If headers is already a string, apply string redaction
    if (typeof headers === 'string') {
        return redactSensitiveString(headers);
    }

    // If not an object, return as-is
    if (typeof headers !== 'object') {
        return headers;
    }

    const redacted: Record<string, unknown> = {};

    for (const [headerName, headerValue] of Object.entries(headers)) {
        const lowerName = headerName.toLowerCase();

        // Check if this is a sensitive header that needs full redaction
        const isSensitiveHeader = SENSITIVE_HEADERS.some((h) => lowerName.includes(h));

        if (isSensitiveHeader) {
            // Full value redaction for auth headers
            redacted[headerName] = '[REDACTED]';
        } else if (typeof headerValue === 'string') {
            // Apply string redaction to other header values
            redacted[headerName] = redactSensitiveString(headerValue);
        } else {
            // Keep non-string values as-is
            redacted[headerName] = headerValue;
        }
    }

    return redacted;
}

/**
 * Universal data redaction - handles any data type
 * Recursively applies redaction to strings within objects/arrays.
 * Also checks key names against sensitive words and redacts entire values.
 * Preserves the input type structure for OTel compatibility.
 *
 * @param data - The data to redact (any type)
 * @returns The redacted data with the same type structure
 */
export function redactData<T>(data: T): T {
    if (data === null || data === undefined) {
        return data;
    }

    // String: apply string redaction
    if (typeof data === 'string') {
        return redactSensitiveString(data) as T;
    }

    // Array: recursively redact each element
    if (Array.isArray(data)) {
        return data.map((item) => redactData(item)) as T;
    }

    // Object: recursively redact each value, also check key names
    if (typeof data === 'object') {
        const redacted: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
            // Check if the key name matches any sensitive word
            const keyMatchesSensitive = SENSITIVE_WORDS.some((word) => key.toLowerCase().includes(word.toLowerCase()));

            if (keyMatchesSensitive) {
                // Redact the entire value if the key is sensitive
                redacted[key] = '[REDACTED]';
            } else {
                // Otherwise, recursively process the value
                redacted[key] = redactData(value);
            }
        }
        return redacted as T;
    }

    // Other types (numbers, booleans, etc.): return as-is
    return data;
}
