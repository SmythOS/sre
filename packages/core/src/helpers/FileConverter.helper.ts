import { BinaryInput } from './BinaryInput.helper';
import { IAccessCandidate } from '@sre/types/ACL.types';

/**
 * Interface for file converters that can convert files from one MIME type to another
 */
export interface IFileConverter {
    /**
     * The source MIME type this converter can handle
     */
    readonly sourceMimeType: string;

    /**
     * The target MIME type this converter produces
     */
    readonly targetMimeType: string;

    /**
     * Check if this converter can convert from the given source MIME type
     * @param sourceMimeType The source MIME type to check
     * @returns True if this converter can handle the source MIME type
     */
    canConvert(sourceMimeType: string): boolean;

    /**
     * Convert a file from source format to target format
     * @param file The BinaryInput file to convert
     * @param candidate Access candidate for file operations
     * @returns A new BinaryInput with the converted file data
     */
    convert(file: BinaryInput, candidate: IAccessCandidate): Promise<BinaryInput>;
}

/**
 * Registry for managing file converters
 * Allows registration and lookup of converters for unsupported file types
 */
export class FileConverterRegistry {
    private converters: Map<string, IFileConverter[]> = new Map();

    /**
     * Register a file converter
     * @param converter The converter to register
     */
    register(converter: IFileConverter): void {
        const sourceMime = converter.sourceMimeType;
        if (!this.converters.has(sourceMime)) {
            this.converters.set(sourceMime, []);
        }
        this.converters.get(sourceMime)!.push(converter);
    }

    /**
     * Find a converter that can convert from the given source MIME type to any of the supported target MIME types
     * @param sourceMimeType The source MIME type to convert from
     * @param supportedMimeTypes Array of MIME types that are supported by the target (model/provider)
     * @returns The first matching converter, or null if none found
     */
    findConverter(sourceMimeType: string, supportedMimeTypes: string[]): IFileConverter | null {
        const converters = this.converters.get(sourceMimeType);
        if (!converters || converters.length === 0) {
            return null;
        }

        // Find a converter whose target MIME type is in the supported list
        for (const converter of converters) {
            if (supportedMimeTypes.includes(converter.targetMimeType)) {
                return converter;
            }
        }

        return null;
    }

    /**
     * Get all converters for a specific source MIME type
     * @param sourceMimeType The source MIME type
     * @returns Array of converters for that source type
     */
    getConverters(sourceMimeType: string): IFileConverter[] {
        return this.converters.get(sourceMimeType) || [];
    }

    /**
     * Check if there's a converter available for the given source MIME type
     * that can convert to any of the supported target MIME types
     * @param sourceMimeType The source MIME type
     * @param supportedMimeTypes Array of supported target MIME types
     * @returns True if a converter is available
     */
    hasConverter(sourceMimeType: string, supportedMimeTypes: string[]): boolean {
        return this.findConverter(sourceMimeType, supportedMimeTypes) !== null;
    }
}

/**
 * Global instance of the file converter registry
 * Converters should be registered here during initialization
 */
export const fileConverterRegistry = new FileConverterRegistry();
