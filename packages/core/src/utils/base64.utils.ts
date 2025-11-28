import { fileTypeFromBuffer } from 'file-type';
import { isValidString } from './string.utils';
import { MAX_FILE_SIZE } from '@sre/constants';

/**
 * This function converts a text string to a base64 URL.
 * @param text
 * @returns
 */
export function textToBase64Url(text) {
    // Create a Buffer from the string
    const buffer = Buffer.from(text, 'utf-8');

    // Convert the Buffer to a base64 string
    const base64String = buffer.toString('base64');

    // Construct the data URL
    const base64Url = `data:text/plain;base64,${base64String}`;

    return base64Url;
}

export const isBase64FileUrl = (url: string): boolean => {
    if (typeof url !== 'string') return false;

    const regex = /^data:([\w+\-\.]+\/[\w+\-\.]+);base64,(.*)$/;
    const match = url.match(regex);
    if (!match) return false;
    const [, , base64Data] = match;

    return isBase64(base64Data);
};

export const getMimetypeFromBase64Data = async (data: string) => {
    try {
        data = _cleanUpBase64Data(data);

        // Convert the base64 string back to a Buffer
        const imageBuffer = Buffer.from(data, 'base64');

        const type = await fileTypeFromBuffer(imageBuffer);
        return type?.mime || '';
    } catch (error) {
        console.error('Error getting mimetype from base64 data: ', error);
        return '';
    }
};

export async function getBase64FileInfo(data: string): Promise<{ data: string; mimetype: string; size: number } | null> {
    if (isBase64FileUrl(data)) {
        const regex = /^data:([^;]+);base64,(.*)$/;
        const match = data.match(regex);
        if (!match) return { data: '', mimetype: '', size: 0 };
        const [, mimetype, base64Data] = match;

        const cleanData = _cleanUpBase64Data(base64Data);
        const buffer = Buffer.from(cleanData, 'base64');

        return { data: cleanData, mimetype, size: buffer.byteLength };
    } else if (isBase64(data)) {
        const cleanData = _cleanUpBase64Data(data);
        const buffer = Buffer.from(cleanData, 'base64');

        return {
            data: cleanData,
            mimetype: await getMimetypeFromBase64Data(cleanData),
            size: buffer.byteLength,
        };
    }

    return null;
}

//=== Legacy code below ===
//@Forhad the functions below need to be reviewed and refactored

/**
 * Remove all whitespace characters and literal \n and \s sequences
 *
 * @note It's common practice to split base64 data into multiple lines for better readability and to avoid issues with systems that can't handle very long lines. So we need to clean up newline characters from the base64 data before processing it.
 * @param {string} str - The input string.
 * @returns {string} The input string with all newline characters and escaped newline strings removed.
 */
function cleanBase64(str: string): string {
    return str.replace(/\s|\\n|\\s/g, '');
}

/**
 * Checks if the input is a data URL.
 *
 * @param {string} input - The input string.
 * @returns {boolean} True if the input is a data URL, false otherwise.
 */
export function isBase64DataUrl(input: string): boolean {
    // Data URL pattern: data:[<mediatype>][;base64],<data>
    const pattern = /^data:([\w+\-\.]+\/[\w+\-\.]+);base64,(.*)$/;

    return pattern.test(input);
}

/**
 * Checks if the given string is a valid Base64-encoded string.
 *
 * @param {string} str - The string to check.
 * @returns {boolean} True if the string is a valid Base64-encoded string, false otherwise.
 */
export function isBase64(str: string): boolean {
    if (!isValidString(str)) return false;

    const cleanedBase64Data = cleanBase64(str);

    // Sometimes words like 'male' and hashes like md5, sha1, sha256, sha512 are detected as base64
    // if (cleanedBase64Data.length < 128) return false;

    try {
        const buffer = Buffer.from(cleanedBase64Data, 'base64');

        // ignoring trailing padding ensures that the comparison is based on the actual content, not the padding
        return buffer.toString('base64').replace(/=+$/, '') === cleanedBase64Data.replace(/=+$/, '');
    } catch {
        return false;
    }
}

/**
 * Parses a Base64-encoded data URL and extracts the MIME type and cleaned data.
 *
 * @param {string} input - The Base64-encoded data URL.
 * @returns {{ mimetype: string; data: string }} An object containing the MIME type and the cleaned Base64 data.
 * @throws {Error} If the input is invalid.
 */
function parseBase64DataUrl(input: string): { mimetype: string; data: string } {
    const pattern = /^data:([\w+\-\.]+\/[\w+\-\.]+);base64,(.*)$/;
    const matches = input.match(pattern);

    if (!matches) {
        throw new Error('Invalid data URL!');
    }

    const [, mimetype, data] = matches;

    if (!isBase64(data)) {
        throw new Error('Invalid base64 data!');
    }

    return { mimetype, data: cleanBase64(data) };
}

/**
 * Parses a Base64-encoded string and extracts the MIME type and cleaned data.
 *
 * @param {string} input - The Base64-encoded string.
 * @returns {Promise<{ mimetype: string; data: string }>} An object containing the MIME type and the cleaned Base64 data.
 */
export async function parseBase64(input: string): Promise<{ mimetype: string; data: string }> {
    const cleanedData = cleanBase64(input);
    const mimetype = await identifyMimetypeFromBase64(cleanedData);

    return { mimetype, data: cleanedData };
}

/**
 * Identifies the MIME type from a Base64-encoded string.
 *
 * This function cleans the input Base64 string, converts it to a buffer, and then identifies the MIME type
 * using the `fileTypeFromBuffer` function.
 *
 * @param {string} data - The Base64-encoded string from which to identify the MIME type.
 * @returns {Promise<string>} A promise that resolves to the MIME type of the data, or an empty string if the MIME type cannot be determined.
 *
 * @throws {Error} If an error occurs during the process, it logs the error and returns an empty string.
 */
export async function identifyMimetypeFromBase64(data: string): Promise<string> {
    try {
        const cleanedData = cleanBase64(data);

        // Convert the base64 string back to a Buffer
        const buffer = Buffer.from(cleanedData, 'base64');

        const type = await fileTypeFromBuffer(buffer);

        return type?.mime || '';
    } catch (error) {
        throw new Error(`Error identifying MIME type from base64 data: ${error?.message}`);
    }
}

/**
 * Identifies the MIME type from a Base64-encoded string.
 *
 * This function cleans the input Base64 string, converts it to a buffer, and then identifies the MIME type
 * using the `fileTypeFromBuffer` function.
 *
 * @param {string} data - The Base64-encoded string from which to identify the MIME type.
 * @returns {Promise<string>} A promise that resolves to the MIME type of the data, or an empty string if the MIME type cannot be determined.
 *
 * @throws {Error} If an error occurs during the process, it logs the error and returns an empty string.
 */
export async function identifyMimeTypeFromBase64DataUrl(input: string): Promise<string> {
    try {
        const { data } = await parseBase64DataUrl(input);

        const buffer = Buffer.from(data, 'base64');

        const type = await fileTypeFromBuffer(buffer);

        return type?.mime || '';
    } catch (error) {
        throw new Error(`Error identifying MIME type from base64 data: ${error?.message}`);
    }
}

/**
 * Calculates the size of a Base64-encoded string in bytes.
 *
 * This function validates the input string to ensure it is a valid Base64-encoded string,
 * converts it to a buffer, and then returns the byte length of the buffer.
 *
 * @param {string} str - The Base64-encoded string whose size is to be calculated.
 * @returns {number} The size of the Base64-encoded string in bytes.
 *
 * @throws {Error} If the input string is not a valid Base64-encoded string or if an error occurs during conversion.
 */
export function getSizeOfBase64(str: string): number {
    if (!isValidString(str)) {
        throw new Error('Invalid Base64 data!');
    }

    try {
        const buffer = Buffer.from(str, 'base64');
        return buffer.byteLength;
    } catch (error) {
        throw new Error(`Invalid Base64 data! ${error.message}`);
    }
}

/**
 * Generates a Base64 Data URL from a Base64-encoded string.
 *
 * This function validates the input Base64 string, removes any newline characters,
 * and constructs a Data URL with the specified MIME type.
 *
 * @param {string} data - The Base64-encoded string to be converted into a Data URL.
 * @param {string} [mimetype='application/octet-stream'] - The MIME type of the data. Defaults to 'application/octet-stream'.
 * @returns {string} The generated Base64 Data URL.
 *
 * @throws {Error} If the input string is not a valid Base64-encoded string.
 */
export function makeBase64Url(data: string, mimetype: string = 'application/octet-stream'): string {
    if (!isValidString(data)) {
        throw new Error('Invalid Base64 data!');
    }

    // Remove any newline characters from the Base64 string
    const cleanedData = data.replace(/\n/g, '');

    // Construct and return the Data URL
    return `data:${mimetype};base64,${cleanedData}`;
}

/**
 ** It's common practice to split base64 data into multiple lines for better readability and to avoid issues with systems that can't handle very long lines.
 ** So we need to clean up newline characters from the base64 data before processing it.
 * @param {string} str - The input string.
 * @returns {string} The input string with all newline characters and escaped newline strings removed.
 */
const _cleanUpBase64Data = (str: string): string => {
    // Check if the input is a string and is not excessively large
    if (typeof str !== 'string' || str.length > MAX_FILE_SIZE) {
        throw new Error('Invalid input');
    }

    // Remove all whitespace characters and literal \n and \s sequences
    return str.replace(/\s|\\n|\\s/g, '');
};
