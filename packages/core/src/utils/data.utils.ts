import { Readable } from 'stream';
import axios from 'axios';

import { identifyMimeTypeFromBase64DataUrl, isBase64FileUrl, isBase64, identifyMimetypeFromBase64, isBase64DataUrl } from './base64.utils';
import { isBinaryFileSync } from 'isbinaryfile';
import { fileTypeFromBuffer } from 'file-type';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';

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
        string: () => 'text/plain',
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
// TODO [Forhad]: Need to apply same thing for Base64, etc.
export async function formatDataForDebug(data: any) {
    let dataForDebug;

    if (!data) {
        return data;
    }

    try {
        if (data.constructor?.name === 'BinaryInput') {
            dataForDebug = `[BinaryInput name=${await data.getName()}]`;
        } else if (isBuffer(data)) {
            dataForDebug = `[Buffer size=${data.length}]`;
        } else if (data.constructor?.name === 'FormData') {
            dataForDebug = `[FormData]`;
        } else {
            dataForDebug = data;
        }
    } catch (error) {
        // Fallback to a safe representation if any error occurs
        dataForDebug = '[Object]';
    }

    return dataForDebug;
}

// TODO: Maybe we need move this function to any helper file, as it depends on BinaryInput class
export async function normalizeImageInput(inputImage: string | BinaryInput): Promise<string> {
    if (!inputImage) {
        throw new Error('Input image is required');
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
