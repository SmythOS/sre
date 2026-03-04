import { DocParser, TDocumentParseSettings, TParsedDocument } from '../DocParser.class';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * Parses PDF files into a structured TParsedDocument representation.
 * Extracts text content, metadata, and embedded images from each page.
 *
 * Uses @libpdf/core under the hood, but callers interact only with
 * the DocParser public API and TParsedDocument output type.
 */
export class PDFParser extends DocParser {
    protected supportedMimeTypes: string[] = ['application/pdf'];
    protected supportedExtensions: string[] = ['pdf'];

    async parse(source: string, params?: TDocumentParseSettings): Promise<TParsedDocument> {
        const { PDF, PdfStream } = await import('@libpdf/core');

        try {
            const dataBuffer = await readFile(source);
            const fileNameWithoutExtension = path.basename(source, path.extname(source));

            const pdf = await PDF.load(new Uint8Array(dataBuffer));
            const pageCount = pdf.getPageCount();
            const pages = [];

            for (let i = 0; i < pageCount; i++) {
                const page = pdf.getPage(i);
                const content: Array<{ type: 'text' | 'image'; data: string; text: string }> = [];

                if (page) {
                    const extracted = page.extractText();
                    if (extracted.text.trim().length > 0) {
                        content.push({
                            type: 'text',
                            data: extracted.text,
                            text: extracted.text,
                        });
                    }

                    // Walk /Resources/XObject to find embedded images.
                    // JPEG images are emitted with a data-URI; other formats
                    // (raw pixel data) produce a placeholder entry.
                    try {
                        const resources = page.dict.getDict('Resources');
                        const xObjectDict = resources?.getDict('XObject');

                        if (xObjectDict) {
                            const ctx = pdf.context;

                            for (const pdfName of xObjectDict.keys()) {
                                const ref = xObjectDict.getRef(pdfName.value);
                                if (!ref) continue;

                                const resolved = ctx.resolve(ref);
                                if (!(resolved instanceof PdfStream)) continue;

                                const subtypeName = resolved.getName('Subtype');
                                if (subtypeName?.value !== 'Image') continue;

                                const w = resolved.getNumber('Width')?.value ?? 'unknown';
                                const h = resolved.getNumber('Height')?.value ?? 'unknown';
                                const filterName = resolved.getName('Filter')?.value;

                                if (filterName === 'DCTDecode') {
                                    const jpegData = resolved.getEncodedData();
                                    const base64 = Buffer.from(jpegData).toString('base64');
                                    content.push({
                                        type: 'image',
                                        data: `data:image/jpeg;base64,${base64}`,
                                        text: `[Embedded Image: ${w}x${h}]`,
                                    });
                                } else {
                                    content.push({
                                        type: 'image',
                                        data: '',
                                        text: `[Image Placeholder: ${w}x${h}]`,
                                    });
                                }
                            }
                        }
                    } catch {
                        // Image extraction is best-effort; failures are non-fatal
                    }
                }

                pages.push({
                    content,
                    metadata: { pageNumber: i + 1 },
                });
            }

            const title = pdf.getTitle();
            const author = pdf.getAuthor();
            const creationDate = pdf.getCreationDate();
            const keywords = pdf.getKeywords();

            const tags = (keywords || [])
                .flatMap((k: string) => k.split(','))
                .map((k: string) => k.trim())
                .filter(Boolean);

            return {
                title: title || fileNameWithoutExtension || '',
                metadata: {
                    uri: source,
                    author: author || '',
                    date: creationDate ? creationDate.toISOString() : '',
                    tags,
                },
                pages,
            };
        } catch (error) {
            console.error('PDF parsing error:', error);
            throw error;
        }
    }
}
