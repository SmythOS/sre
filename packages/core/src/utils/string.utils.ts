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
