import { DocParser, TDocumentParseSettings, TParsedDocument } from '../DocParser.class';
import { readFile } from 'fs/promises';
import * as mammoth from 'mammoth';

export class DOCXParser extends DocParser {
    constructor(source: string, params?: TDocumentParseSettings) {
        super(source, params);
    }

    async parse(): Promise<TParsedDocument> {
        try {
            const dataBuffer = await readFile(this.source);

            // Parse document structure with enhanced page break detection
            const documentStructure = await this.extractDocumentStructure(dataBuffer);

            // Extract images using mammoth (better image handling)
            const images = await this.extractImages(dataBuffer);

            // Split content into pages based on page breaks
            const pages = this.createPagesFromStructure(documentStructure, images);

            console.log(
                `Successfully parsed DOCX: ${pages.length} pages with ${pages.reduce(
                    (total, page) => total + page.content.length,
                    0
                )} total content items`
            );

            return {
                title: this.extractTitleFromPath(this.source),
                metadata: {
                    uri: this.source,
                    author: '',
                    date: '',
                    tags: [],
                },
                pages: pages,
            };
        } catch (error) {
            console.error('DOCX parsing error:', error);
            throw error;
        }
    }

    private async extractDocumentStructure(buffer: Buffer): Promise<any[]> {
        // Use mammoth to get structured content with enhanced page break detection
        const options = {
            includeDefaultStyleMap: true,
            includeEmbeddedStyleMap: true,
            // Custom style map to detect page breaks and preserve structure
            styleMap: [
                "p[style-name='Normal'] => p:fresh",
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Heading 2'] => h2:fresh",
                "p[style-name='Heading 3'] => h3:fresh",
                "br[type='page'] => hr.page-break",
                "p[style-name='Page Break'] => hr.page-break",
                // Add more page break style mappings
                "p[style-name='Page Break Before'] => hr.page-break",
                "p[style-name='Page Break After'] => hr.page-break",
            ],
        };

        const result = await mammoth.convertToHtml({ buffer }, options);

        // Parse the HTML to identify content blocks and page breaks
        return this.parseHtmlToStructure(result.value);
    }

    private parseHtmlToStructure(html: string): any[] {
        const structure: any[] = [];

        // Enhanced page break detection patterns
        const pageBreakPatterns = [
            /<hr[^>]*class="page-break"[^>]*>/gi,
            /<hr[^>]*>/gi, // Any hr tag could be a page break
            /<div[^>]*page-break[^>]*>/gi,
            /<p[^>]*page-break[^>]*>/gi,
            // Look for Word-specific page break indicators
            /<w:br[^>]*w:type="page"[^>]*>/gi,
            /<w:lastRenderedPageBreak[^>]*>/gi,
        ];

        let content = html;
        let pageBreakFound = false;

        // Replace all page break patterns with a consistent marker
        pageBreakPatterns.forEach((pattern) => {
            if (pattern.test(content)) {
                pageBreakFound = true;
                content = content.replace(pattern, '<!-- PAGE_BREAK -->');
            }
        });

        // If no explicit page breaks found, look for other indicators
        if (!pageBreakFound) {
            // Look for form feed characters
            content = content.replace(/\f/g, '<!-- PAGE_BREAK -->');

            // Look for multiple consecutive line breaks that might indicate page breaks
            content = content.replace(/(<br\s*\/?>){4,}/gi, '<!-- PAGE_BREAK -->');

            // Look for large gaps in content (multiple empty paragraphs)
            content = content.replace(/(<p[^>]*>\s*<\/p>\s*){4,}/gi, '<!-- PAGE_BREAK -->');

            // Look for heading patterns that might indicate new pages
            content = content.replace(/(<\/h[1-3]>\s*<h[1-2][^>]*>)/gi, '$1<!-- PAGE_BREAK -->');
        }

        // Split by page break markers
        const sections = content.split('<!-- PAGE_BREAK -->');

        sections.forEach((section, index) => {
            const cleanSection = section.trim();
            if (cleanSection.length > 0) {
                structure.push({
                    type: 'page',
                    pageNumber: index + 1,
                    content: cleanSection,
                    isPageBreak: index > 0,
                });
            }
        });

        // If we still only have one section and it's very long, split by content length
        if (structure.length === 1 && structure[0].content.length > 4000) {
            return this.splitLongContentIntoPages(structure[0].content);
        }

        // Ensure we have at least one page
        return structure.length > 0
            ? structure
            : [
                  {
                      type: 'page',
                      pageNumber: 1,
                      content: html,
                      isPageBreak: false,
                  },
              ];
    }

    private splitLongContentIntoPages(content: string): any[] {
        // Split very long content into reasonable page sizes
        const targetPageSize = 3000; // Increased target size
        const pages: any[] = [];

        // Split by paragraphs first to maintain content integrity
        const paragraphs = content.split(/(<\/p>)/gi);
        let currentPage = '';
        let pageNumber = 1;

        for (let i = 0; i < paragraphs.length; i += 2) {
            const paragraph = paragraphs[i] || '';
            const closingTag = paragraphs[i + 1] || '';
            const fullParagraph = paragraph + closingTag;

            // Check if adding this paragraph would exceed the target size
            if (currentPage.length + fullParagraph.length > targetPageSize && currentPage.length > 500) {
                // Save current page and start new one
                pages.push({
                    type: 'page',
                    pageNumber: pageNumber,
                    content: currentPage.trim(),
                    isPageBreak: pageNumber > 1,
                });
                currentPage = fullParagraph;
                pageNumber++;
            } else {
                currentPage += fullParagraph;
            }
        }

        // Add the last page if it has content
        if (currentPage.trim().length > 0) {
            pages.push({
                type: 'page',
                pageNumber: pageNumber,
                content: currentPage.trim(),
                isPageBreak: pageNumber > 1,
            });
        }

        return pages.length > 0
            ? pages
            : [
                  {
                      type: 'page',
                      pageNumber: 1,
                      content: content,
                      isPageBreak: false,
                  },
              ];
    }

    private async extractImages(buffer: Buffer): Promise<Map<string, string>> {
        const images = new Map<string, string>();

        try {
            const options = {
                convertImage: mammoth.images.imgElement((image: any) => {
                    return image.read('base64').then((imageBuffer: Buffer) => {
                        const base64 = imageBuffer.toString('base64');
                        const contentType = this.getImageContentType(image.contentType);
                        const dataUrl = `data:${contentType};base64,${base64}`;

                        // Store image with a key for later reference
                        const imageKey = `img_${images.size}`;
                        images.set(imageKey, dataUrl);

                        return {
                            src: dataUrl,
                            alt: `Embedded image (${image.contentType})`,
                        };
                    });
                }),
            };

            await mammoth.convertToHtml({ buffer }, options);
        } catch (error) {
            console.warn('Could not extract images:', error);
        }

        return images;
    }

    private createPagesFromStructure(structure: any[], images: Map<string, string>): any[] {
        return structure.map((pageData) => {
            const content = this.parseHtmlContent(pageData.content, images);

            return {
                content: content,
                metadata: {
                    pageNumber: pageData.pageNumber,
                    hasPageBreak: pageData.isPageBreak,
                },
            };
        });
    }

    private parseHtmlContent(html: string, images: Map<string, string>): any[] {
        const content: any[] = [];

        // Split HTML into text and image sections
        const parts = html.split(/(<img[^>]*>)/g);

        for (const part of parts) {
            if (part.trim() === '') continue;

            if (part.startsWith('<img')) {
                // Extract image information
                const srcMatch = part.match(/src="([^"]+)"/);
                const altMatch = part.match(/alt="([^"]+)"/);

                if (srcMatch) {
                    const src = srcMatch[1];
                    const alt = altMatch ? altMatch[1] : 'Embedded image';

                    content.push({
                        type: 'image' as const,
                        data: src,
                        text: `[${alt}]`,
                    });
                }
            } else {
                // Clean up HTML and extract text
                const cleanText = part
                    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
                    .replace(/\s+/g, ' ') // Normalize whitespace
                    .trim();

                if (cleanText.length > 0) {
                    content.push({
                        type: 'text' as const,
                        data: cleanText,
                        text: cleanText,
                    });
                }
            }
        }

        return content;
    }

    private getImageContentType(mammothContentType: string): string {
        const typeMap: { [key: string]: string } = {
            'image/png': 'image/png',
            'image/jpeg': 'image/jpeg',
            'image/jpg': 'image/jpeg',
            'image/gif': 'image/gif',
            'image/bmp': 'image/bmp',
            'image/webp': 'image/webp',
            'image/svg+xml': 'image/svg+xml',
        };

        return typeMap[mammothContentType] || 'image/png';
    }

    private extractTitleFromPath(filePath: string): string {
        const fileName = filePath.split(/[/\\]/).pop() || '';
        return fileName.replace(/\.[^.]*$/, '');
    }
}
