// prettier-ignore-file
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TParsedDocument } from '../../../src/DocParser/DocParser.class';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function expectValidDocument(doc: TParsedDocument) {
    expect(doc).toBeDefined();
    expect(doc).toHaveProperty('title');
    expect(doc).toHaveProperty('metadata');
    expect(doc.metadata).toHaveProperty('uri');
    expect(doc.metadata).toHaveProperty('author');
    expect(doc.metadata).toHaveProperty('date');
    expect(doc.metadata).toHaveProperty('tags');
    expect(Array.isArray(doc.metadata.tags)).toBe(true);
    expect(doc).toHaveProperty('pages');
    expect(Array.isArray(doc.pages)).toBe(true);
    expect(doc.pages.length).toBeGreaterThanOrEqual(1);
    for (const page of doc.pages) {
        expect(page).toHaveProperty('content');
        expect(Array.isArray(page.content)).toBe(true);
        expect(page).toHaveProperty('metadata');
    }
}

// ─── Mock fs/promises (shared by both parsers) ─────────────────────────────────

const mockReadFile = vi.fn();

vi.mock('fs/promises', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        readFile: (...args: any[]) => mockReadFile(...args),
    };
});

// Default: return a fake buffer for known test extensions
beforeEach(() => {
    mockReadFile.mockImplementation((filePath: string, encoding?: string) => {
        if (typeof filePath === 'string' && (filePath.endsWith('.pdf') || filePath.endsWith('.docx'))) {
            return Promise.resolve(Buffer.from('fake file data'));
        }
        // Fallback: reject for unknown paths (real fs would fail anyway)
        return Promise.reject(new Error(`ENOENT: no such file or directory, open '${filePath}'`));
    });
});

// ─── Mock pdfjs-dist ────────────────────────────────────────────────────────────

const mockGetTextContent = vi.fn();
const mockGetOperatorList = vi.fn();
const mockGetPage = vi.fn();
const mockGetMetadata = vi.fn();
const mockPdfDocument = {
    numPages: 2,
    getPage: mockGetPage,
    getMetadata: mockGetMetadata,
};

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => {
    return {
        getDocument: vi.fn().mockReturnValue({
            promise: Promise.resolve(mockPdfDocument),
        }),
        GlobalWorkerOptions: { workerSrc: '' },
        OPS: { paintImageXObject: 85 },
    };
});

// ─── Mock mammoth ───────────────────────────────────────────────────────────────

const mockConvertToHtml = vi.fn();

vi.mock('mammoth', () => {
    return {
        convertToHtml: (...args: any[]) => mockConvertToHtml(...args),
        images: {
            imgElement: vi.fn().mockImplementation((fn: any) => fn),
        },
    };
});

// ─── PDFParser ──────────────────────────────────────────────────────────────────

describe('PDFParser', () => {
    let PDFParser: any;
    let parser: any;

    // Default mock behavior for PDF tests
    function setupDefaultPdfMocks() {
        mockGetTextContent.mockResolvedValue({
            items: [{ str: 'Hello ' }, { str: 'World' }],
        });
        mockGetOperatorList.mockResolvedValue({
            fnArray: [],
            argsArray: [],
        });
        mockGetPage.mockResolvedValue({
            getTextContent: mockGetTextContent,
            getOperatorList: mockGetOperatorList,
            objs: { get: vi.fn() },
        });
        mockGetMetadata.mockResolvedValue({
            info: {
                Title: 'Test PDF',
                Author: 'Test Author',
                CreationDate: '2025-01-01',
                Keywords: 'tag1, tag2',
            },
        });
    }

    beforeEach(async () => {
        vi.clearAllMocks();
        setupDefaultPdfMocks();
        const mod = await import('../../../src/DocParser/parsers/PDFParser.class');
        PDFParser = mod.PDFParser;
        parser = new PDFParser();
    });

    describe('successful parsing', () => {
        it('should parse a PDF file and return a valid document', async () => {
            const doc = await parser.parse('/path/to/test.pdf');
            expectValidDocument(doc);
        });

        it('should extract title from PDF metadata', async () => {
            const doc = await parser.parse('/path/to/test.pdf');
            expect(doc.title).toBe('Test PDF');
        });

        it('should extract author from PDF metadata', async () => {
            const doc = await parser.parse('/path/to/test.pdf');
            expect(doc.metadata.author).toBe('Test Author');
        });

        it('should extract date from PDF metadata', async () => {
            const doc = await parser.parse('/path/to/test.pdf');
            expect(doc.metadata.date).toBe('2025-01-01');
        });

        it('should extract tags from keywords', async () => {
            const doc = await parser.parse('/path/to/test.pdf');
            expect(doc.metadata.tags).toEqual(['tag1', 'tag2']);
        });

        it('should set uri to source path', async () => {
            const doc = await parser.parse('/path/to/test.pdf');
            expect(doc.metadata.uri).toBe('/path/to/test.pdf');
        });

        it('should extract text from pages', async () => {
            const doc = await parser.parse('/path/to/test.pdf');
            // 2 pages, each with "Hello  World" (space-joined str values)
            expect(doc.pages).toHaveLength(2);
            expect(doc.pages[0].content[0].type).toBe('text');
            expect(doc.pages[0].content[0].data).toBe('Hello  World');
        });

        it('should include page numbers in metadata', async () => {
            const doc = await parser.parse('/path/to/test.pdf');
            expect(doc.pages[0].metadata.pageNumber).toBe(1);
            expect(doc.pages[1].metadata.pageNumber).toBe(2);
        });
    });

    describe('fallback title from filename', () => {
        it('should use filename when PDF metadata has no title', async () => {
            mockGetMetadata.mockResolvedValueOnce({
                info: { Title: '', Author: '', CreationDate: '', Keywords: '' },
            });

            const doc = await parser.parse('/docs/my-report.pdf');
            // Title falls back to filename without extension when info.Title is empty
            expect(doc.title).toBe('my-report');
        });
    });

    describe('pages with no text content', () => {
        it('should handle pages with empty text', async () => {
            mockGetPage.mockResolvedValue({
                getTextContent: vi.fn().mockResolvedValue({ items: [] }),
                getOperatorList: vi.fn().mockResolvedValue({ fnArray: [], argsArray: [] }),
                objs: { get: vi.fn() },
            });
            const origNumPages = mockPdfDocument.numPages;
            mockPdfDocument.numPages = 1;

            const doc = await parser.parse('/path/to/empty.pdf');
            expect(doc.pages[0].content).toHaveLength(0);

            mockPdfDocument.numPages = origNumPages;
        });
    });

    describe('error handling', () => {
        it('should throw when readFile fails', async () => {
            mockReadFile.mockRejectedValueOnce(new Error('File not found'));

            await expect(parser.parse('/nonexistent.pdf')).rejects.toThrow('File not found');
        });
    });

    describe('image extraction', () => {
        it('should handle pages with PNG image operators', async () => {
            const origNumPages = mockPdfDocument.numPages;
            mockPdfDocument.numPages = 1;

            mockGetPage.mockResolvedValueOnce({
                getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'Page text' }] }),
                getOperatorList: vi.fn().mockResolvedValue({
                    fnArray: [85], // OPS.paintImageXObject
                    argsArray: [['img_0']],
                }),
                objs: {
                    get: vi.fn().mockReturnValue({
                        data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]), // PNG header
                        width: 100,
                        height: 200,
                        kind: 1,
                    }),
                },
            });

            const doc = await parser.parse('/path/to/images.pdf');
            const imageContent = doc.pages[0].content.filter((c: any) => c.type === 'image');
            expect(imageContent.length).toBe(1);
            expect(imageContent[0].data).toContain('data:image/png;base64,');
            expect(imageContent[0].text).toContain('100x200');

            mockPdfDocument.numPages = origNumPages;
        });

        it('should handle raw pixel data images gracefully', async () => {
            const origNumPages = mockPdfDocument.numPages;
            mockPdfDocument.numPages = 1;

            mockGetPage.mockResolvedValueOnce({
                getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'text' }] }),
                getOperatorList: vi.fn().mockResolvedValue({
                    fnArray: [85],
                    argsArray: [['img_raw']],
                }),
                objs: {
                    get: vi.fn().mockReturnValue({
                        data: new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]), // not a valid image header
                        width: 50,
                        height: 50,
                        kind: 1,
                    }),
                },
            });

            const doc = await parser.parse('/path/to/rawimg.pdf');
            const imageContent = doc.pages[0].content.filter((c: any) => c.type === 'image');
            expect(imageContent.length).toBe(1);
            expect(imageContent[0].data).toBe(''); // Empty data for raw pixels
            expect(imageContent[0].text).toContain('Image Placeholder');

            mockPdfDocument.numPages = origNumPages;
        });

        it('should handle JPEG images', async () => {
            const origNumPages = mockPdfDocument.numPages;
            mockPdfDocument.numPages = 1;

            mockGetPage.mockResolvedValueOnce({
                getTextContent: vi.fn().mockResolvedValue({ items: [] }),
                getOperatorList: vi.fn().mockResolvedValue({
                    fnArray: [85],
                    argsArray: [['img_jpeg']],
                }),
                objs: {
                    get: vi.fn().mockReturnValue({
                        data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]), // JPEG header
                        width: 640,
                        height: 480,
                        kind: 1,
                    }),
                },
            });

            const doc = await parser.parse('/path/to/jpeg.pdf');
            const imageContent = doc.pages[0].content.filter((c: any) => c.type === 'image');
            expect(imageContent.length).toBe(1);
            expect(imageContent[0].data).toContain('data:image/jpeg;base64,');

            mockPdfDocument.numPages = origNumPages;
        });

        it('should skip images with no extractable data', async () => {
            const origNumPages = mockPdfDocument.numPages;
            mockPdfDocument.numPages = 1;

            mockGetPage.mockResolvedValueOnce({
                getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'text' }] }),
                getOperatorList: vi.fn().mockResolvedValue({
                    fnArray: [85],
                    argsArray: [['img_nodata']],
                }),
                objs: {
                    get: vi.fn().mockReturnValue({
                        data: null,
                        width: 10,
                        height: 10,
                    }),
                },
            });

            const doc = await parser.parse('/path/to/nodata.pdf');
            const imageContent = doc.pages[0].content.filter((c: any) => c.type === 'image');
            expect(imageContent.length).toBe(0);

            mockPdfDocument.numPages = origNumPages;
        });

        it('should handle image object not found', async () => {
            const origNumPages = mockPdfDocument.numPages;
            mockPdfDocument.numPages = 1;

            mockGetPage.mockResolvedValueOnce({
                getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'text' }] }),
                getOperatorList: vi.fn().mockResolvedValue({
                    fnArray: [85],
                    argsArray: [['img_missing']],
                }),
                objs: {
                    get: vi.fn().mockReturnValue(null),
                },
            });

            const doc = await parser.parse('/path/to/missingimg.pdf');
            const imageContent = doc.pages[0].content.filter((c: any) => c.type === 'image');
            expect(imageContent.length).toBe(0);

            mockPdfDocument.numPages = origNumPages;
        });
    });

    describe('keyword parsing', () => {
        it('should handle empty keywords', async () => {
            mockGetMetadata.mockResolvedValueOnce({
                info: { Title: 'T', Author: '', CreationDate: '', Keywords: '' },
            });

            const doc = await parser.parse('/path/to/nokw.pdf');
            expect(doc.metadata.tags).toEqual([]);
        });

        it('should split comma-separated keywords', async () => {
            mockGetMetadata.mockResolvedValueOnce({
                info: { Title: 'T', Author: '', CreationDate: '', Keywords: 'alpha, beta,  gamma' },
            });

            const doc = await parser.parse('/path/to/kw.pdf');
            expect(doc.metadata.tags).toEqual(['alpha', 'beta', 'gamma']);
        });
    });
});

// ─── DOCXParser ─────────────────────────────────────────────────────────────────

describe('DOCXParser', () => {
    let DOCXParser: any;
    let parser: any;

    function setupDefaultDocxMocks() {
        mockConvertToHtml.mockResolvedValue({
            value: '<h1>Test Heading</h1><p>Paragraph one content here.</p><p>Paragraph two content here.</p>',
            messages: [],
        });
    }

    beforeEach(async () => {
        vi.clearAllMocks();
        setupDefaultDocxMocks();
        // Restore default readFile mock after clearAllMocks
        mockReadFile.mockImplementation((filePath: string) => {
            if (typeof filePath === 'string' && (filePath.endsWith('.pdf') || filePath.endsWith('.docx'))) {
                return Promise.resolve(Buffer.from('fake file data'));
            }
            return Promise.reject(new Error(`ENOENT: no such file or directory, open '${filePath}'`));
        });

        const mod = await import('../../../src/DocParser/parsers/DOCXParser.class');
        DOCXParser = mod.DOCXParser;
        parser = new DOCXParser();
    });

    describe('successful parsing', () => {
        it('should parse a DOCX file and return a valid document', async () => {
            const doc = await parser.parse('/path/to/document.docx');
            expectValidDocument(doc);
        });

        it('should extract title from file path', async () => {
            const doc = await parser.parse('/path/to/my-report.docx');
            expect(doc.title).toBe('my-report');
        });

        it('should extract title from Windows-style path', async () => {
            const doc = await parser.parse('C:\\Users\\test\\report.docx');
            expect(doc.title).toBe('report');
        });

        it('should set uri to source path', async () => {
            const doc = await parser.parse('/path/to/file.docx');
            expect(doc.metadata.uri).toBe('/path/to/file.docx');
        });

        it('should have default empty metadata', async () => {
            const doc = await parser.parse('/path/to/file.docx');
            expect(doc.metadata.author).toBe('');
            expect(doc.metadata.date).toBe('');
            expect(doc.metadata.tags).toEqual([]);
        });
    });

    describe('content extraction', () => {
        it('should extract text content from HTML', async () => {
            const doc = await parser.parse('/path/to/file.docx');
            const textContent = doc.pages
                .flatMap((p: any) => p.content)
                .filter((c: any) => c.type === 'text');
            expect(textContent.length).toBeGreaterThanOrEqual(1);
            const allText = textContent.map((c: any) => c.data).join(' ');
            expect(allText).toContain('Paragraph one content here');
        });

        it('should handle empty document', async () => {
            mockConvertToHtml.mockResolvedValue({
                value: '',
                messages: [],
            });

            const doc = await parser.parse('/path/to/empty.docx');
            expectValidDocument(doc);
        });

        it('should handle HTML with images', async () => {
            mockConvertToHtml.mockResolvedValue({
                value: '<p>Text before</p><img src="data:image/png;base64,abc123" alt="Test Image"><p>Text after</p>',
                messages: [],
            });

            const doc = await parser.parse('/path/to/withimg.docx');
            const allContent = doc.pages.flatMap((p: any) => p.content);
            const images = allContent.filter((c: any) => c.type === 'image');
            expect(images.length).toBe(1);
            expect(images[0].data).toContain('data:image/png;base64,');
            expect(images[0].text).toContain('Test Image');
        });
    });

    describe('page break handling', () => {
        it('should detect hr.page-break elements', async () => {
            mockConvertToHtml.mockResolvedValue({
                value: '<p>Page 1 content</p><hr class="page-break"><p>Page 2 content</p>',
                messages: [],
            });

            const doc = await parser.parse('/path/to/multipage.docx');
            expect(doc.pages.length).toBe(2);
        });

        it('should number pages correctly', async () => {
            mockConvertToHtml.mockResolvedValue({
                value: '<p>First</p><hr class="page-break"><p>Second</p><hr class="page-break"><p>Third</p>',
                messages: [],
            });

            const doc = await parser.parse('/path/to/threepages.docx');
            expect(doc.pages.length).toBe(3);
            expect(doc.pages[0].metadata.pageNumber).toBe(1);
            expect(doc.pages[1].metadata.pageNumber).toBe(2);
            expect(doc.pages[2].metadata.pageNumber).toBe(3);
        });

        it('should handle documents with no page breaks as single page', async () => {
            mockConvertToHtml.mockResolvedValue({
                value: '<p>Short single page document.</p>',
                messages: [],
            });

            const doc = await parser.parse('/path/to/singlepage.docx');
            expect(doc.pages.length).toBeGreaterThanOrEqual(1);
            expect(doc.pages[0].metadata.pageNumber).toBe(1);
        });
    });

    describe('long content splitting', () => {
        it('should split very long single-section content into multiple pages', async () => {
            // Generate a single HTML section > 4000 chars with multiple paragraphs
            const longParagraphs = Array.from({ length: 30 }, (_, i) =>
                `<p>${'Lorem ipsum dolor sit amet. '.repeat(10)} Paragraph ${i}.</p>`
            ).join('');
            mockConvertToHtml.mockResolvedValue({
                value: longParagraphs,
                messages: [],
            });

            const doc = await parser.parse('/path/to/long.docx');
            expect(doc.pages.length).toBeGreaterThan(1);
            // Each page should have content
            for (const page of doc.pages) {
                expect(page.content.length).toBeGreaterThan(0);
            }
        });
    });

    describe('image extraction', () => {
        it('should extract embedded images via mammoth convertImage handler', async () => {
            // The mock mammoth.images.imgElement passes the handler through
            // Provide HTML with image references
            mockConvertToHtml.mockResolvedValue({
                value: '<p>Text with image</p><img src="data:image/png;base64,aW1hZ2VkYXRh" alt="Embedded"><p>After image</p>',
                messages: [],
            });

            const doc = await parser.parse('/path/to/images.docx');
            const allContent = doc.pages.flatMap((p: any) => p.content);
            const images = allContent.filter((c: any) => c.type === 'image');
            expect(images.length).toBe(1);
        });
    });

    describe('error handling', () => {
        it('should throw when readFile fails', async () => {
            mockReadFile.mockRejectedValueOnce(new Error('Cannot read DOCX'));

            await expect(parser.parse('/nonexistent.docx')).rejects.toThrow('Cannot read DOCX');
        });

        it('should throw when mammoth conversion fails', async () => {
            mockConvertToHtml.mockRejectedValue(new Error('Conversion failed'));

            await expect(parser.parse('/path/to/corrupt.docx')).rejects.toThrow('Conversion failed');
        });
    });

    describe('supported types', () => {
        it('should declare docx as supported extension', () => {
            expect(parser['supportedExtensions']).toContain('docx');
        });

        it('should declare OOXML MIME type', () => {
            expect(parser['supportedMimeTypes']).toContain(
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            );
        });
    });
});
