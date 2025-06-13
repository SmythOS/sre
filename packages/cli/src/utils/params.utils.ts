function splitParamString(paramString: string): string[] {
    // Split parameter string by spaces while respecting quotes
    const params: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaped = false;

    for (let i = 0; i < paramString.length; i++) {
        const char = paramString[i];

        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }

        if (char === '\\') {
            current += char;
            escaped = true;
            continue;
        }

        if (char === "'" && !inDoubleQuote) {
            current += char;
            inSingleQuote = !inSingleQuote;
        } else if (char === '"' && !inSingleQuote) {
            current += char;
            inDoubleQuote = !inDoubleQuote;
        } else if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
            if (current.trim()) {
                params.push(current.trim());
                current = '';
            }
        } else {
            current += char;
        }
    }

    // Add the last parameter
    if (current.trim()) {
        params.push(current.trim());
    }

    return params;
}

function parseKeyValueParam(param: string): Record<string, any> | null {
    // Find the first equals sign that's not inside quotes
    let equalsIndex = -1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaped = false;

    for (let i = 0; i < param.length; i++) {
        const char = param[i];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        if (char === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
        } else if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
        } else if (char === '=' && !inSingleQuote && !inDoubleQuote) {
            equalsIndex = i;
            break;
        }
    }

    if (equalsIndex === -1) {
        // No equals sign found, treat as boolean flag
        return { [param]: true };
    }

    const key = param.substring(0, equalsIndex).trim();
    let value = param.substring(equalsIndex + 1).trim();

    if (!key) {
        console.warn(`Invalid parameter format: ${param}`);
        return null;
    }

    // Remove surrounding quotes and handle escaping
    value = unquoteAndUnescape(value);

    // Try to parse as JSON for numbers, booleans, etc.
    const parsedValue = tryParseValue(value);

    return { [key]: parsedValue };
}

function unquoteAndUnescape(value: string): string {
    if (!value) return value;

    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
    }

    // Unescape common escape sequences
    return value.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
}

function tryParseValue(value: string): any {
    if (!value) return value;

    // Try to parse as number
    if (!isNaN(Number(value)) && !isNaN(parseFloat(value))) {
        return Number(value);
    }

    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Try to parse as JSON (for arrays, objects)
    if (value.startsWith('[') || value.startsWith('{')) {
        try {
            return JSON.parse(value);
        } catch {
            // If JSON parsing fails, return as string
        }
    }

    return value;
}

export function parseParams(params: string | string[]): any {
    if (!params || (Array.isArray(params) && params.length === 0)) {
        return {};
    }

    // Join array elements and split by spaces (respecting quotes)
    const paramString = Array.isArray(params) ? params.join(' ') : params;
    const individualParams = splitParamString(paramString);

    // Parse each parameter and flatten into a single object
    const result: Record<string, any> = {};

    for (const param of individualParams) {
        const parsed = parseKeyValueParam(param);
        if (parsed) {
            Object.assign(result, parsed);
        }
    }

    return result;
}
