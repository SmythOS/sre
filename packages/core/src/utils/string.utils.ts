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
