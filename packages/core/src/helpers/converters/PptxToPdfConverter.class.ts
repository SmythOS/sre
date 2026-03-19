import { BinaryInput } from '../BinaryInput.helper';
import { IFileConverter } from '../FileConverter.helper';
import { IAccessCandidate } from '@sre/types/ACL.types';
import path from 'path';
import { fileConverterRegistry } from '../FileConverter.helper';

/**
 * Converter that converts PPTX (PowerPoint) files to PDF format
 * Uses the pptx-to-pdf npm package for conversion
 * 
 * To add a new converter:
 * 1. Create a new class implementing IFileConverter interface
 * 2. Set sourceMimeType and targetMimeType properties
 * 3. Implement canConvert() and convert() methods
 * 4. Register the converter at the bottom of the file: fileConverterRegistry.register(new YourConverter())
 * 5. Import the converter file in LLM.inference.ts to ensure it's registered
 */
export class PptxToPdfConverter implements IFileConverter {
    readonly sourceMimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    readonly targetMimeType = 'application/pdf';

    canConvert(sourceMimeType: string): boolean {
        return sourceMimeType === this.sourceMimeType;
    }

    async convert(file: BinaryInput, candidate: IAccessCandidate): Promise<BinaryInput> {
        // Import pptx-to-pdf dynamically to avoid loading it if not needed
        const { convert } = await import('pptx-to-pdf');

        // Get the file buffer directly - no need to write to disk
        const pptxBuffer = await file.getBuffer();
        if (!pptxBuffer || !Buffer.isBuffer(pptxBuffer)) {
            throw new Error('Failed to read file buffer for conversion');
        }

        try {
            // Convert PPTX buffer directly to PDF buffer
            const pdfBuffer = await convert(pptxBuffer);

            if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
                throw new Error('Conversion failed: invalid PDF buffer returned');
            }

            // Get the original filename and change extension to .pdf
            const originalName = await file.getName();
            const baseName = path.parse(originalName).name;
            const newName = `${baseName}.pdf`;

            // Create a new BinaryInput with the converted PDF buffer
            const convertedFile = BinaryInput.from(pdfBuffer, newName, this.targetMimeType, candidate);

            return convertedFile;
        } catch (error) {
            throw new Error(`Failed to convert PPTX to PDF: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

// Register the converter when this module is imported
const pptxToPdfConverter = new PptxToPdfConverter();
fileConverterRegistry.register(pptxToPdfConverter);
