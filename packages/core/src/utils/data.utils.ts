import { Readable } from 'stream';
import axios from 'axios';
import * as fs from 'fs';

import { identifyMimeTypeFromBase64DataUrl, isBase64FileUrl, isBase64, identifyMimetypeFromBase64, isBase64DataUrl } from './base64.utils';
import { isBinaryFileSync } from 'isbinaryfile';
import { fileTypeFromBuffer } from 'file-type';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { identifyMimetypeFromString } from './string.utils';
import { IAccessCandidate } from '@sre/types/ACL.types';

// Helper function to convert stream to buffer
export async function streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

/////////////////////////////////////////////////////////////////////////////////////////////
// == Helpers from Legacy Smyth implementation ==============================================
// FIXME : below functions should probably be converted to a validator

//export declare function isBinaryFile(file: string | Buffer, size?: number): Promise<boolean>;
//export declare function isBinaryFileSync(file: string | Buffer, size?: number): boolean;
const binaryMimeTypes = ['image/', 'audio/', 'video/', 'application/pdf', 'application/zip', 'application/octet-stream'];

export function dataToBuffer(data: any): Buffer | null {
    let bufferData;
    switch (true) {
        case data instanceof ArrayBuffer:
            bufferData = Buffer.from(new Uint8Array(data));
            break;
        case ArrayBuffer.isView(data) && !(data instanceof DataView):
            bufferData = Buffer.from(new Uint8Array(data.buffer));
            break;
        case data instanceof DataView:
            bufferData = Buffer.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
            break;
        case Buffer.isBuffer(data):
            bufferData = data;
            break;
        case typeof data === 'string':
            bufferData = Buffer.from(data, 'utf-8');
            break;
        default:
            return null;
    }

    return bufferData;
}

export const getSizeFromBinary = (data: any) => {
    const buffer = dataToBuffer(data);
    if (!buffer) return 0;
    return buffer.byteLength;
};

/**
 * Calculates the size in bytes of a base64-encoded string after decoding
 *
 * @param base64String - The base64 string to calculate the size for. Can be a raw base64 string or a data URL.
 * @returns The size in bytes of the decoded data
 */
function getBase64FileSize(base64String: string): number {
    // Remove data URL prefix if present
    const base64Data = base64String.includes(';base64,') ? base64String.split(';base64,')[1] : base64String;

    // Formula: (n * 3) / 4 - padding
    const padding = base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0;
    return Math.floor((base64Data.length * 3) / 4) - padding;
}

export const isPlainObject = (data: any): boolean => {
    return (
        typeof data === 'object' &&
        data !== null &&
        !Array.isArray(data) &&
        Object.prototype.toString.call(data) === '[object Object]' &&
        data.constructor === Object
    );
};

// isBuffer checks if the provided data is a Buffer object in Node.js.
export const isBuffer = (data: any): boolean => {
    try {
        return Buffer.isBuffer(data);
    } catch {
        // Buffer.isBuffer throws error when non-array Object is passed
        return false;
    }
};

// isBinaryMimeType checks if the provided mimetype indicates binary data.
export const isBinaryMimeType = (mimetype): boolean => {
    if (mimetype) {
        return binaryMimeTypes.some((type) => mimetype.startsWith(type));
    }
    return false;
};

// isBinaryData checks if the provided data is binary.
// If the data is a Buffer, ArrayBuffer, TypedArray, or DataView, it checks if it contains binary data.
export const isBinaryData = (data): boolean => {
    // To prevent returning true when we have emojis in the string like "Hello 😀"
    if (typeof data === 'string') return false;

    try {
        const buffer = dataToBuffer(data);
        if (!buffer) return false;
        return isBinaryFileSync(buffer, buffer.byteLength);
    } catch (error) {
        return false;
    }
};

// TODO: Need to check if this is intentional, I think we're checking for http/https urls only
export function isUrl(str: string): boolean {
    if (typeof str !== 'string') return false;
    // This regex checks for protocol, hostname, domain, port (optional), path (optional), and query string (optional)
    //const regex = /^(https?:\/\/)([^\s.]+\.[^\s]{2,})(:[0-9]{1,5})?(\/[^\s]*)?(\?[^\s]*)?$/i;
    const regex = /^([a-zA-Z0-9]+:\/\/)([^\s.]+\.[^\s]{2,})(:[0-9]{1,5})?(\/[^\s]*)?(\?[^\s]*)?$/i;

    return regex.test(str);
}

export function isFile(str: string): boolean {
    // Check if string exists and length is within limit
    if (!str || str.length >= 1000) {
        return false;
    }

    // Validate path format for both Windows and Unix systems
    if (!isValidPathFormat(str)) {
        return false;
    }

    // Check if file exists using fs.stat
    try {
        const stats = fs.statSync(str);
        return stats.isFile();
    } catch (error) {
        // File doesn't exist or permission denied
        return false;
    }
}

/**
 * Validates if a string is in a valid file path format for both Windows and Unix systems
 * Supports both absolute and relative paths
 */
function isValidPathFormat(path: string): boolean {
    // Check for invalid characters that are not allowed in file paths
    const invalidChars = /[\0<>"|?*]/;
    if (invalidChars.test(path)) {
        return false;
    }

    // Windows path patterns
    const windowsAbsolute = /^[a-zA-Z]:[\\\/]/; // C:\ or C:/
    const windowsUNC = /^\\\\[^\\]+\\[^\\]+/; // \\server\share
    const windowsRelative = /^\.{1,2}[\\\/]/; // .\ or ..\ or ./ or ../

    // Unix path patterns
    const unixAbsolute = /^\//; // /path/to/file
    const unixHome = /^~[\/]/; // ~/path/to/file
    const unixRelative = /^\.{1,2}\//; // ./ or ../

    // Relative paths without leading ./ or .\
    const genericRelative = /^[^\\\/]/; // path/to/file or path\to\file

    // Check if path matches any valid pattern
    return (
        windowsAbsolute.test(path) ||
        windowsUNC.test(path) ||
        windowsRelative.test(path) ||
        unixAbsolute.test(path) ||
        unixHome.test(path) ||
        unixRelative.test(path) ||
        genericRelative.test(path)
    );
}

export function isSmythFsUrl(str: string): boolean {
    if (typeof str !== 'string') return false;
    const regex = /^smythfs:\/\/([^\s.]+\.[^\s]{2,})(:[0-9]{1,5})?(\/[^\s]*)?(\?[^\s]*)?$/i;
    return regex.test(str);
}

export const isSmythFileObject = (data: any): boolean => {
    return !!(typeof data === 'object' && data !== null && data?.url && isUrl(data?.url) && 'size' in data && 'mimetype' in data);
};

export const isBufferObject = (data: Record<string, any>): boolean => {
    if (!data) return false;

    return typeof data === 'object' && data !== null && data?.buffer && isBuffer(data.buffer) && 'size' in data && 'mimetype' in data;
};

export const isBase64Object = (data: Record<string, any>): boolean => {
    if (!data) return false;

    return typeof data === 'object' && data !== null && data?.base64 && isBase64(data.base64) && 'size' in data && 'mimetype' in data;
};

export async function getMimeType(data: any): Promise<string> {
    const mimeTypeGetters = {
        blob: () => data.type,
        buffer: async () => {
            try {
                // TODO: debug why this is not returning a file type for images when used through BinaryInput.helper.ts
                const fileType = await fileTypeFromBuffer(data);
                return fileType?.mime ?? '';
            } catch {
                console.warn('Failed to get mime type from buffer');
                return '';
            }
        },
        url: async () => {
            try {
                const response = await axios.get(data); // head() method does not work for all URLs
                const contentType = response.headers['content-type'];
                return contentType;
            } catch {
                console.warn('Failed to get mime type from URL');
                return '';
            }
        },
        smythFile: () => data.mimetype,
        base64DataUrl: () => identifyMimeTypeFromBase64DataUrl(data),
        base64: () => identifyMimetypeFromBase64(data),
        string: () => identifyMimetypeFromString(data),
    };

    const typeChecks = {
        blob: data instanceof Blob,
        buffer: isBuffer(data),
        url: isUrl(data),
        smythFile: isSmythFileObject(data),
        base64DataUrl: isBase64FileUrl(data),
        base64: isBase64(data),
        string: typeof data === 'string',
    };

    const [matchedType = ''] = Object.entries(typeChecks).find(([, value]) => value) || [];
    if (!matchedType) return '';

    return await mimeTypeGetters?.[matchedType]?.();
}

// Mask data like Buffer, FormData, etc. in debug output
// TODO [Forhad]: Need to get the size of FormData
export async function formatDataForDebug(data: any, candidate: IAccessCandidate) {
    let dataForDebug;

    if (!data) {
        return data;
    }

    try {
        // We use .includes() instead of === because constructor.name can be 'BinaryInput$1', 'FormData$1', etc.
        // This happens when the same class is loaded in different module contexts (bundling, HMR, circular deps)
        if (data.constructor?.name.includes('BinaryInput')) {
            const jsonData = await data.getJsonData(candidate);
            dataForDebug = `[BinaryInput size=${jsonData?.size}]`;
        } else if (isBuffer(data)) {
            dataForDebug = `[Buffer size=${data.byteLength}]`;
        } else if (data.constructor?.name.includes('FormData')) {
            dataForDebug = `[FormData]`;
        } else if (isBase64(data) || isBase64DataUrl(data)) {
            dataForDebug = `[Base64 size=${getBase64FileSize(data)}]`;
        } else {
            dataForDebug = data;
        }
    } catch (error) {
        // Fallback to a safe representation if any error occurs
        dataForDebug = '[Binary]';
    }

    return dataForDebug;
}

// TODO: Maybe we need move this function to any helper file, as it depends on BinaryInput class
export async function normalizeImageInput(inputImage: string | BinaryInput): Promise<string> {
    if (!inputImage) {
        return '';
    }

    // Handle string inputs
    if (typeof inputImage === 'string') {
        if (isBase64(inputImage)) {
            // Convert raw base64 to data URL with proper MIME type
            const mimeType = (await getMimeType(inputImage)) || 'image/png';
            return `data:${mimeType};base64,${inputImage}`;
        }

        if (isBase64DataUrl(inputImage)) {
            return inputImage; // Already in correct format
        }

        if (isUrl(inputImage)) {
            return inputImage; // Valid URL, return as-is
        }

        throw new Error('Invalid string input: must be base64, data URL, or HTTP(S) URL');
    }

    // Handle BinaryInput
    // * There is a bug (server crash) when we check like this: inputImage instanceof BinaryInput
    // TODO [Forhad]: Need find out the root cause and fix it
    if (inputImage.constructor?.name === 'BinaryInput') {
        try {
            const buffer = await inputImage.getBuffer();
            const mimeType = (await getMimeType(buffer)) || 'image/png';
            const base64Data = buffer.toString('base64');
            return `data:${mimeType};base64,${base64Data}`;
        } catch (error) {
            throw new Error(`Failed to process BinaryInput: ${error.message}`);
        }
    }

    throw new Error('Unsupported input type');
}
