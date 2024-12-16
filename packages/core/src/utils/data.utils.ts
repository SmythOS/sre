import { Readable } from 'stream';
import { isRawBase64 } from './base64.utils';
import { isBinaryFileSync } from 'isbinaryfile';
import * as FileType from 'file-type';

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
export function isUrl(str: string): boolean {
    if (typeof str !== 'string') return false;
    // This regex checks for protocol, hostname, domain, port (optional), path (optional), and query string (optional)
    //const regex = /^(https?:\/\/)([^\s.]+\.[^\s]{2,})(:[0-9]{1,5})?(\/[^\s]*)?(\?[^\s]*)?$/i;
    const regex = /^([a-zA-Z0-9]+:\/\/)([^\s.]+\.[^\s]{2,})(:[0-9]{1,5})?(\/[^\s]*)?(\?[^\s]*)?$/i;

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

    return typeof data === 'object' && data !== null && data?.base64 && isRawBase64(data.base64) && 'size' in data && 'mimetype' in data;
};

export async function getMimeType(data: any): Promise<string> {
    if (data instanceof Blob) return data.type;
    if (isBuffer(data)) {
        try {
            const fileType = await FileType.fileTypeFromBuffer(data);
            return fileType.mime;
        } catch {
            return '';
        }
    }

    if (typeof data === 'string') {
        return 'text/plain';
    }
}
