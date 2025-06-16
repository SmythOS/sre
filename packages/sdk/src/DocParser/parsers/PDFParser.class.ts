import { DocParser, TDocumentParseSettings, TParsedDocument } from '../DocParser.class';
import { readFile } from 'fs/promises';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker for pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.mjs';

export class PDFParser extends DocParser {
    constructor(source: string, params?: TDocumentParseSettings) {
        super(source, params);
    }

    async parse(): Promise<TParsedDocument> {
        try {
            const dataBuffer = await readFile(this.source);
            const fileNameWithoutExtension = path.basename(this.source, path.extname(this.source));

            // Use pdfjs-dist for text extraction and metadata
            const loadingTask = pdfjsLib.getDocument({
                data: new Uint8Array(dataBuffer),
                fontExtraProperties: true,
            } as any);
            const pdfDocument = await loadingTask.promise;

            let fullText = '';
            const pages = [];

            // Process each page
            for (let i = 1; i <= pdfDocument.numPages; i++) {
                const page = await pdfDocument.getPage(i);
                const textContent = await page.getTextContent();
                const operatorList = await page.getOperatorList();

                const content: any[] = [];

                // 1. Extract text content
                const pageText = textContent.items.map((item: any) => item.str).join(' ');
                if (pageText.trim().length > 0) {
                    content.push({
                        type: 'text' as const,
                        data: pageText,
                        text: pageText,
                    });
                }

                // 2. Extract embedded images with improved approach
                const imageNames = new Set<string>();

                // First, collect all image names from the operator list
                for (let j = 0; j < operatorList.fnArray.length; j++) {
                    const fn = operatorList.fnArray[j];
                    const args = operatorList.argsArray[j];

                    if (fn === pdfjsLib.OPS.paintImageXObject) {
                        const imageName = args[0];
                        imageNames.add(imageName);
                    }
                }

                // Then try to extract each unique image
                for (const imageName of imageNames) {
                    try {
                        // Wait a bit to ensure objects are loaded
                        await new Promise((resolve) => setTimeout(resolve, 100));

                        // Try to get the image object
                        const imageObj = page.objs.get(imageName);

                        if (imageObj) {
                            console.log(`Found image object ${imageName}:`, {
                                hasData: !!imageObj.data,
                                dataType: typeof imageObj.data,
                                dataLength: imageObj.data?.length,
                                width: imageObj.width,
                                height: imageObj.height,
                                kind: imageObj.kind,
                                keys: Object.keys(imageObj),
                            });

                            if (imageObj.data && (imageObj.data instanceof Uint8Array || Buffer.isBuffer(imageObj.data))) {
                                const dataArray = imageObj.data instanceof Uint8Array ? imageObj.data : new Uint8Array(imageObj.data);

                                // Check for standard image file signatures first
                                let isValidImageFile = false;
                                let mimeType = 'image/png';

                                if (dataArray.length > 4) {
                                    const headerBytes = [];
                                    for (let i = 0; i < 4; i++) {
                                        headerBytes.push(dataArray[i].toString(16).padStart(2, '0'));
                                    }
                                    const header = headerBytes.join('');

                                    if (header.startsWith('ffd8')) {
                                        // Valid JPEG file
                                        isValidImageFile = true;
                                        mimeType = 'image/jpeg';
                                        console.log(`Found valid JPEG file ${imageName}`);
                                    } else if (header.startsWith('8950')) {
                                        // Valid PNG file
                                        isValidImageFile = true;
                                        mimeType = 'image/png';
                                        console.log(`Found valid PNG file ${imageName}`);
                                    } else {
                                        console.log(`Image ${imageName} header: ${header} - appears to be raw pixel data`);
                                    }
                                }

                                if (isValidImageFile) {
                                    // Extract the valid image file
                                    const base64Image = Buffer.from(dataArray).toString('base64');
                                    content.push({
                                        type: 'image' as const,
                                        data: `data:${mimeType};base64,${base64Image}`,
                                        text: `[Embedded Image: ${imageObj.width || 'unknown'}x${imageObj.height || 'unknown'}]`,
                                    });
                                    console.log(`Successfully extracted ${mimeType} image ${imageName} from page ${i}`);
                                } else {
                                    // This is raw pixel data - provide metadata without invalid base64
                                    console.log(`Image ${imageName} contains raw pixel data, providing metadata only`);
                                    content.push({
                                        type: 'image' as const,
                                        data: '', // Empty data to avoid invalid base64
                                        text: `[Image Placeholder: ${imageObj.width || 'unknown'}x${
                                            imageObj.height || 'unknown'
                                        } - Raw pixel data not extractable via PDF.js]`,
                                        metadata: {
                                            imageName: imageName,
                                            width: imageObj.width,
                                            height: imageObj.height,
                                            kind: imageObj.kind,
                                            dataLength: dataArray.length,
                                            note: 'This image exists in the PDF but is stored as raw pixel data. Consider using specialized PDF image extraction tools for full image recovery.',
                                        },
                                    });
                                }
                            } else {
                                console.warn(`Image ${imageName} has no extractable data`);
                            }
                        } else {
                            console.warn(`Image object ${imageName} not found`);
                        }
                    } catch (error: any) {
                        console.warn(`Could not extract image ${imageName} from page ${i}: ${error.message}`);
                    }
                }

                fullText += pageText + '\n\n';
                pages.push({
                    content: content,
                    metadata: { pageNumber: i },
                });
            }

            // Extract metadata
            const metadata = await pdfDocument.getMetadata();
            const info = (metadata.info as any) || {};

            return {
                title: info.Title || fileNameWithoutExtension || '',
                metadata: {
                    uri: this.source,
                    author: info.Author || '',
                    date: info.CreationDate || '',
                    tags: (info.Keywords || '')
                        .split(',')
                        .map((k: string) => k.trim())
                        .filter(Boolean),
                },
                pages: pages,
            };
        } catch (error) {
            console.error('PDF parsing error:', error);
            throw error;
        }
    }
}
