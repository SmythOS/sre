/**
 * perform a replace operation on a string asynchronously
 * @param str
 * @param regex
 * @param asyncFn
 * @returns
 */
export async function asyncReplace(str, regex, asyncFn) {
    const matches = [];
    let match;

    // Find all matches and store them in an array
    while ((match = regex.exec(str)) !== null) {
        matches.push(match);
    }

    // Process each match asynchronously
    const replacements = await Promise.all(
        matches.map(async (match) => {
            // Call the async function with all match groups
            return asyncFn(...match);
        })
    );

    // Reassemble the string with replacements
    let result = '';
    let lastIndex = 0;

    matches.forEach((match, index) => {
        result += str.slice(lastIndex, match.index) + replacements[index];
        lastIndex = match.index + match[0].length;
    });

    // Append the remaining part of the string
    result += str.slice(lastIndex);

    return result;
}

export function isValidString(str: string): boolean {
    return str && typeof str === 'string';
}

const isValidNumber = (str: string): boolean => {
    const num = parseFloat(str);
    return !isNaN(num) && num <= Number.MAX_SAFE_INTEGER && num >= Number.MIN_SAFE_INTEGER && num.toString() === str.trim();
};

/**
 * The function parseJson() won't parse the data for property values.
 * For instance, if you have '{"a": "1","b": "true"}', it will be parsed as {a: '1', b: 'true'}. That's why we parse the appropriate data type for property values
 * so that the data will be parsed as {a: 1, b: true}
 * @param data
 * @returns
 */
export function convertStringToRespectiveType(data: any): any {
    if (data === null || data === undefined) return data;

    if (typeof data !== 'object') {
        // If it's a string, perform conversions
        if (typeof data === 'string') {
            if (data.toLowerCase() === 'true') {
                return true;
            } else if (data.toLowerCase() === 'false') {
                return false;
            } else if (isValidNumber(data)) {
                return Number(data);
            } else if (data.toLowerCase() === 'null') {
                return null;
            } else if (data.toLowerCase() === 'undefined') {
                return undefined;
            }
        }

        return data;
    }

    // If it's an array, map over it and parse each item
    if (Array.isArray(data)) {
        return data.map((item) => convertStringToRespectiveType(item));
    }

    // If it's an object, map over its properties and parse each one
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, convertStringToRespectiveType(value)]));
}

export const kebabToCamel = (input) => {
    if (!input || typeof input !== 'string') return input;

    return input.replace(/-([a-z])/g, function (match, group) {
        return group.toUpperCase();
    });
};

export const kebabToCapitalize = (input) => {
    if (!input || typeof input !== 'string') return input;

    return input
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

/**
 * This function reads a string and tries to identify the mimetype (e.g. text/plain, application/json, application/xml ...)
 * @param input
 */
export const identifyMimetypeFromString = (input: string) => {
    // Return null if input is not a string
    if (typeof input !== 'string') {
        return '';
    }

    // Return null for empty strings
    if (!input.trim()) {
        return '';
    }

    const trimmedInput = input.trim();

    // Check for JSON
    if ((trimmedInput.startsWith('{') && trimmedInput.endsWith('}')) || (trimmedInput.startsWith('[') && trimmedInput.endsWith(']'))) {
        try {
            JSON.parse(trimmedInput);
            return 'application/json';
        } catch {
            // Not valid JSON, continue checking
        }
    }

    // Check for XML
    if (trimmedInput.startsWith('<') && trimmedInput.endsWith('>')) {
        // More specific XML patterns
        if (trimmedInput.match(/^<\?xml\s/i) || trimmedInput.match(/^<[a-zA-Z][^>]*>.*<\/[a-zA-Z][^>]*>$/s)) {
            return 'application/xml';
        }

        // Check for HTML
        if (
            trimmedInput.match(/^<!DOCTYPE\s+html/i) ||
            trimmedInput.match(/<html[^>]*>/i) ||
            trimmedInput.match(/<head[^>]*>/i) ||
            trimmedInput.match(/<body[^>]*>/i) ||
            trimmedInput.match(/<div[^>]*>/i) ||
            trimmedInput.match(/<p[^>]*>/i)
        ) {
            return 'text/html';
        }

        // Check for SVG
        if (trimmedInput.match(/<svg[^>]*>/i)) {
            return 'image/svg+xml';
        }

        // Generic XML if it has XML structure
        return 'application/xml';
    }

    // Check for CSS
    if (trimmedInput.match(/^[^{]*\{[^}]*\}/s) || trimmedInput.match(/@(import|media|charset|keyframes|font-face)/i)) {
        return 'text/css';
    }

    // Check for JavaScript
    if (
        trimmedInput.match(/^(function\s+\w+|var\s+\w+|let\s+\w+|const\s+\w+|class\s+\w+)/i) ||
        trimmedInput.match(/(console\.log|document\.|window\.|require\(|import\s+)/i) ||
        trimmedInput.match(/=>\s*{|function\s*\(/)
    ) {
        return 'application/javascript';
    }

    // Check for YAML
    if (trimmedInput.match(/^---\s*$/m) || trimmedInput.match(/^[a-zA-Z_][a-zA-Z0-9_]*:\s*[^\n]+$/m) || trimmedInput.match(/^\s*-\s+[^\n]+$/m)) {
        return 'application/yaml';
    }

    // Check for CSV
    const lines = trimmedInput.split('\n');
    if (lines.length > 1) {
        const firstLine = lines[0];
        const hasCommas = firstLine.includes(',');
        const hasSemicolons = firstLine.includes(';');
        const hasTabs = firstLine.includes('\t');

        if (hasCommas || hasSemicolons || hasTabs) {
            // Check if multiple lines have similar delimiter patterns
            const delimiter = hasCommas ? ',' : hasSemicolons ? ';' : '\t';
            const firstLineFields = firstLine.split(delimiter).length;

            let csvLikeLines = 0;
            for (let i = 0; i < Math.min(lines.length, 5); i++) {
                const fieldsCount = lines[i].split(delimiter).length;
                if (fieldsCount === firstLineFields && fieldsCount > 1) {
                    csvLikeLines++;
                }
            }

            if (csvLikeLines >= Math.min(lines.length, 3)) {
                return 'text/csv';
            }
        }
    }

    // Check for Markdown
    if (
        trimmedInput.match(/^#+\s+/m) ||
        trimmedInput.match(/^\*\s+/m) ||
        trimmedInput.match(/^-\s+/m) ||
        trimmedInput.match(/\*\*[^*]+\*\*/g) ||
        trimmedInput.match(/\[[^\]]+\]\([^)]+\)/g)
    ) {
        return 'text/markdown';
    }

    // Check for SQL
    if (trimmedInput.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|GRANT|REVOKE)\s+/i)) {
        return 'application/sql';
    }

    // Default to plain text
    return 'text/plain';
};

// export function chunkText(
//     text: string,
//     {
//         chunkSize,
//         chunkOverlap,
//     }: {
//         chunkSize: number;
//         chunkOverlap: number;
//     }
// ): string[] {
//     const textSplitter = new TextSplitter({
//         chunkSize,
//         chunkOverlap,
//         separators: ['\n\n', '\n', ' ', ''],
//         keepSeparator: true,
//     });
//     let output = textSplitter.splitText(text);

//     return output;
// }
// class TextSplitter {
//     private chunkSize: number;
//     private chunkOverlap: number;
//     private separators: string[] = ['\n\n', '\n', ' ', ''];
//     private keepSeparator: boolean = true;

//     constructor({
//         chunkSize = 1000,
//         chunkOverlap = 200,
//         separators,
//         keepSeparator,
//     }: {
//         chunkSize?: number;
//         chunkOverlap?: number;
//         separators?: string[];
//         keepSeparator?: boolean;
//     } = {}) {
//         this.chunkSize = chunkSize;
//         this.chunkOverlap = chunkOverlap;

//         if (separators) {
//             this.separators = separators;
//         }

//         if (keepSeparator !== undefined) {
//             this.keepSeparator = keepSeparator;
//         }

//         if (this.chunkOverlap >= this.chunkSize) {
//             throw new Error('Cannot have chunkOverlap >= chunkSize');
//         }
//     }

//     public splitText(text: string): string[] {
//         return this._splitText(text, this.separators);
//     }

//     private _splitText(text: string, separators: string[]): string[] {
//         const finalChunks: string[] = [];

//         // Get appropriate separator to use
//         let separator: string = separators[separators.length - 1];
//         let newSeparators: string[] | undefined;

//         for (let i = 0; i < separators.length; i += 1) {
//             const s = separators[i];
//             if (s === '') {
//                 separator = s;
//                 break;
//             }
//             if (text.includes(s)) {
//                 separator = s;
//                 newSeparators = separators.slice(i + 1);
//                 break;
//             }
//         }

//         // Split the text using the identified separator
//         const splits = this.splitOnSeparator(text, separator);

//         // Process splits, recursively splitting longer texts
//         let goodSplits: string[] = [];
//         const _separator = this.keepSeparator ? '' : separator;

//         for (const s of splits) {
//             if (this.lengthFunction(s) < this.chunkSize) {
//                 goodSplits.push(s);
//             } else {
//                 if (goodSplits.length) {
//                     const mergedText = this.mergeSplits(goodSplits, _separator);
//                     finalChunks.push(...mergedText);
//                     goodSplits = [];
//                 }

//                 if (!newSeparators) {
//                     finalChunks.push(s);
//                 } else {
//                     const otherInfo = this._splitText(s, newSeparators);
//                     finalChunks.push(...otherInfo);
//                 }
//             }
//         }

//         if (goodSplits.length) {
//             const mergedText = this.mergeSplits(goodSplits, _separator);
//             finalChunks.push(...mergedText);
//         }

//         return finalChunks;
//     }

//     private splitOnSeparator(text: string, separator: string): string[] {
//         let splits: string[];

//         if (separator) {
//             if (this.keepSeparator) {
//                 const regexEscapedSeparator = separator.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
//                 splits = text.split(new RegExp(`(?=${regexEscapedSeparator})`));
//             } else {
//                 splits = text.split(separator);
//             }
//         } else {
//             splits = text.split('');
//         }

//         return splits.filter((s) => s !== '');
//     }

//     private lengthFunction(text: string): number {
//         return text.length;
//     }

//     private joinDocs(docs: string[], separator: string): string | null {
//         const text = docs.join(separator).trim();
//         return text === '' ? null : text;
//     }

//     private mergeSplits(splits: string[], separator: string): string[] {
//         const docs: string[] = [];
//         const currentDoc: string[] = [];
//         let total = 0;

//         for (const d of splits) {
//             const _len = this.lengthFunction(d);

//             if (total + _len + currentDoc.length * separator.length > this.chunkSize) {
//                 if (total > this.chunkSize) {
//                     console.warn(`Created a chunk of size ${total}, which is longer than the specified ${this.chunkSize}`);
//                 }

//                 if (currentDoc.length > 0) {
//                     const doc = this.joinDocs(currentDoc, separator);
//                     if (doc !== null) {
//                         docs.push(doc);
//                     }

//                     // Keep popping if conditions are met
//                     while (total > this.chunkOverlap || (total + _len + currentDoc.length * separator.length > this.chunkSize && total > 0)) {
//                         total -= this.lengthFunction(currentDoc[0]);
//                         currentDoc.shift();
//                     }
//                 }
//             }

//             currentDoc.push(d);
//             total += _len;
//         }

//         const doc = this.joinDocs(currentDoc, separator);
//         if (doc !== null) {
//             docs.push(doc);
//         }

//         return docs;
//     }
// }

// class RecursiveTextSplitter extends TextSplitter {
//     constructor({
//         chunkSize = 1000,
//         chunkOverlap = 200,
//         separators = ['\n\n', '\n', ' ', ''],
//         keepSeparator = true,
//     }: {
//         chunkSize?: number;
//         chunkOverlap?: number;
//         separators?: string[];
//         keepSeparator?: boolean;
//     } = {}) {
//         super({ chunkSize, chunkOverlap, separators, keepSeparator });
//     }
// }
