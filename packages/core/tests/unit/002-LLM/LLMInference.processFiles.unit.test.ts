import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { LLMInference } from '@sre/LLMManager/LLM.inference';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { fileConverterRegistry } from '@sre/helpers/FileConverter.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

vi.mock('@sre/helpers/BinaryInput.helper', () => {
    return {
        BinaryInput: {
            from: vi.fn((source) => source),
        },
    };
});

vi.mock('@sre/helpers/converters/PptxToPdfConverter.class', () => ({}));

function createLLMInference(providerName: string): LLMInference {
    const instance = Object.create(LLMInference.prototype);
    instance._llmProviderName = providerName;
    return instance;
}

function callPrepareFiles(instance: LLMInference, files: any[], candidate: AccessCandidate): Promise<any[]> {
    return (instance as any).prepareFiles(files, candidate);
}

describe('LLMInference.prepareFiles', () => {
    const candidate = { role: 'agent', id: 'test-agent' } as unknown as AccessCandidate;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should pass through files that do not need conversion', async () => {
        const inference = createLLMInference('OpenAI');
        const pngFile = { mimetype: 'image/png', data: 'png-data' };

        const result = await callPrepareFiles(inference, [pngFile], candidate);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(pngFile);
    });

    it('should convert files whose MIME type is in SUPPORTED_MIME_TYPE_CONVERSIONS', async () => {
        const inference = createLLMInference('OpenAI');
        const pptxFile = { mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
        const convertedPdf = { mimetype: 'application/pdf' };

        vi.spyOn(fileConverterRegistry, 'findConverter').mockReturnValue({
            sourceMimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            targetMimeType: 'application/pdf',
            canConvert: vi.fn().mockReturnValue(true),
            convert: vi.fn().mockResolvedValue(convertedPdf),
        });

        const result = await callPrepareFiles(inference, [pptxFile], candidate);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(convertedPdf);
        expect(fileConverterRegistry.findConverter).toHaveBeenCalledWith(
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            ['application/pdf'],
        );
    });

    it('should keep original file when conversion fails', async () => {
        const inference = createLLMInference('OpenAI');
        const pptxFile = { mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };

        vi.spyOn(fileConverterRegistry, 'findConverter').mockReturnValue({
            sourceMimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            targetMimeType: 'application/pdf',
            canConvert: vi.fn().mockReturnValue(true),
            convert: vi.fn().mockRejectedValue(new Error('Conversion failed')),
        });

        const result = await callPrepareFiles(inference, [pptxFile], candidate);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(pptxFile);
    });

    it('should keep original file when no converter exists for a convertible type', async () => {
        const inference = createLLMInference('OpenAI');
        const pptxFile = { mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };

        vi.spyOn(fileConverterRegistry, 'findConverter').mockReturnValue(null);

        const result = await callPrepareFiles(inference, [pptxFile], candidate);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(pptxFile);
    });

    it('should handle a mix of convertible and non-convertible files', async () => {
        const inference = createLLMInference('OpenAI');
        const pngFile = { mimetype: 'image/png' };
        const pptxFile = { mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
        const pdfFile = { mimetype: 'application/pdf' };
        const convertedPdf = { mimetype: 'application/pdf' };

        vi.spyOn(fileConverterRegistry, 'findConverter').mockReturnValue({
            sourceMimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            targetMimeType: 'application/pdf',
            canConvert: vi.fn().mockReturnValue(true),
            convert: vi.fn().mockResolvedValue(convertedPdf),
        });

        const result = await callPrepareFiles(inference, [pngFile, pptxFile, pdfFile], candidate);

        expect(result).toHaveLength(3);
        expect(result[0]).toBe(pngFile);
        expect(result[1]).toBe(convertedPdf);
        expect(result[2]).toBe(pdfFile);
    });

    it('should return all files unchanged for a provider with no conversions', async () => {
        const inference = createLLMInference('GoogleAI');
        const pptxFile = { mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
        const pdfFile = { mimetype: 'application/pdf' };

        const result = await callPrepareFiles(inference, [pptxFile, pdfFile], candidate);

        expect(result).toHaveLength(2);
        expect(result[0]).toBe(pptxFile);
        expect(result[1]).toBe(pdfFile);
    });

    it('should return all files unchanged for an unknown provider', async () => {
        const inference = createLLMInference('UnknownProvider');
        const file = { mimetype: 'image/png' };

        const result = await callPrepareFiles(inference, [file], candidate);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(file);
    });

    it('should pass through files without a mimetype property', async () => {
        const inference = createLLMInference('OpenAI');
        const rawFile = { data: 'some raw data' };

        const result = await callPrepareFiles(inference, [rawFile], candidate);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(rawFile);
    });

    it('should handle empty files array', async () => {
        const inference = createLLMInference('OpenAI');

        const result = await callPrepareFiles(inference, [], candidate);

        expect(result).toHaveLength(0);
    });

    it('should wrap raw file in BinaryInput when conversion is needed and file is not a BinaryInput', async () => {
        const inference = createLLMInference('OpenAI');
        const rawFile = { mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
        const wrappedBinary = { mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
        const convertedPdf = { mimetype: 'application/pdf' };

        (BinaryInput.from as ReturnType<typeof vi.fn>).mockReturnValue(wrappedBinary);

        vi.spyOn(fileConverterRegistry, 'findConverter').mockReturnValue({
            sourceMimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            targetMimeType: 'application/pdf',
            canConvert: vi.fn().mockReturnValue(true),
            convert: vi.fn().mockResolvedValue(convertedPdf),
        });

        const result = await callPrepareFiles(inference, [rawFile], candidate);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(convertedPdf);
        expect(BinaryInput.from).toHaveBeenCalledWith(rawFile, undefined, undefined, candidate);
    });
});
