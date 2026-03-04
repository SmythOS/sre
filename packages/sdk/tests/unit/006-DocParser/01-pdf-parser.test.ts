/**
 * PDFParser Contract Tests
 *
 * These tests verify the public behavioral contract of PDFParser.parse()
 * against the TParsedDocument output type. They are intentionally
 * library-agnostic: no internal PDF library is imported, mocked, or
 * referenced. Swap the underlying library, keep the same output contract,
 * and these tests will confirm backward compatibility.
 *
 * Fixtures are generated programmatically with pdf-lib (a PDF *creation*
 * library, independent of whatever *parsing* library is under test).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFile, mkdir, rm } from 'fs/promises';
import { deflateSync } from 'node:zlib';
import os from 'os';
import path from 'path';

import { PDFParser } from '../../../src/DocParser/parsers/PDFParser.class';
import { Doc } from '../../../src/DocParser/Doc.class';
import type {
    TParsedDocument,
    TDocumentPage,
} from '../../../src/DocParser/DocParser.class';

// ---------------------------------------------------------------------------
// Fixture paths
// ---------------------------------------------------------------------------

const FIXTURE_DIR = path.join(os.tmpdir(), `pdf-parser-contract-${Date.now()}`);

const fixtures = {
    simpleText: path.join(FIXTURE_DIR, 'simple-text.pdf'),
    multiPage: path.join(FIXTURE_DIR, 'multi-page.pdf'),
    emptyPage: path.join(FIXTURE_DIR, 'empty-page.pdf'),
    unicodeText: path.join(FIXTURE_DIR, 'unicode-text.pdf'),
    metadataRich: path.join(FIXTURE_DIR, 'metadata-rich.pdf'),
    noMetadata: path.join(FIXTURE_DIR, 'no-metadata.pdf'),
    embeddedImage: path.join(FIXTURE_DIR, 'embedded-image.pdf'),
    notAPdf: path.join(FIXTURE_DIR, 'not-a-pdf.txt'),
    spacedPath: path.join(FIXTURE_DIR, 'path with spaces', 'spaced.pdf'),
};

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/**
 * Builds a PDF with one or more text pages and optional metadata.
 * Each entry in `pages` becomes a separate PDF page; empty strings
 * produce blank pages (no text drawn).
 */
async function buildTextPdf(
    filePath: string,
    options: {
        pages: string[];
        title?: string;
        author?: string;
        keywords?: string[];
        creationDate?: Date;
    },
): Promise<void> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    for (const text of options.pages) {
        const page = doc.addPage([612, 792]);
        if (text.length > 0) {
            page.drawText(text, {
                x: 50,
                y: 700,
                font,
                size: 12,
                color: rgb(0, 0, 0),
            });
        }
    }

    if (options.title !== undefined) doc.setTitle(options.title);
    if (options.author !== undefined) doc.setAuthor(options.author);
    if (options.keywords !== undefined) doc.setKeywords(options.keywords);
    if (options.creationDate !== undefined) doc.setCreationDate(options.creationDate);

    await writeFile(filePath, await doc.save());
}

/** Computes CRC-32 per ISO 3309 (used by PNG chunk checksums). */
function computeCrc32(buf: Buffer): number {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc & 1) ? ((crc >>> 1) ^ 0xEDB88320) : (crc >>> 1);
        }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Assembles a single PNG chunk (length + type + data + CRC). */
function pngChunk(type: string, data: Buffer): Buffer {
    const typeBytes = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const payload = Buffer.concat([typeBytes, data]);
    const crcVal = computeCrc32(payload);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crcVal);
    return Buffer.concat([len, payload, crc]);
}

/** Creates a minimal valid 4x4 red PNG suitable for PDF embedding. */
function createTestPng(): Uint8Array {
    const width = 4;
    const height = 4;
    const rowBytes = 1 + width * 3;
    const raw = Buffer.alloc(rowBytes * height);

    for (let y = 0; y < height; y++) {
        raw[y * rowBytes] = 0;
        for (let x = 0; x < width; x++) {
            const off = y * rowBytes + 1 + x * 3;
            raw[off] = 255;
            raw[off + 1] = 0;
            raw[off + 2] = 0;
        }
    }

    const compressed = deflateSync(raw);

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    return new Uint8Array(
        Buffer.concat([
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
            pngChunk('IHDR', ihdr),
            pngChunk('IDAT', compressed),
            pngChunk('IEND', Buffer.alloc(0)),
        ]),
    );
}

/** Builds a PDF containing an embedded PNG image drawn on the page. */
async function buildImagePdf(filePath: string): Promise<void> {
    const doc = await PDFDocument.create();
    const pngBytes = createTestPng();
    const image = await doc.embedPng(pngBytes);
    const page = doc.addPage([612, 792]);
    page.drawImage(image, { x: 50, y: 600, width: 100, height: 100 });
    await writeFile(filePath, await doc.save());
}

// ---------------------------------------------------------------------------
// Text extraction helpers
// ---------------------------------------------------------------------------

/** Concatenates all text content items across every page. */
function extractAllText(doc: TParsedDocument): string {
    return doc.pages
        .flatMap(p => p.content.filter(c => c.type === 'text'))
        .map(c => c.data)
        .join(' ');
}

/** Concatenates text content items for a single page. */
function extractPageText(page: TDocumentPage): string {
    return page.content
        .filter(c => c.type === 'text')
        .map(c => c.data)
        .join(' ');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const parser = new PDFParser();

describe('PDFParser - Contract Tests', () => {
    beforeAll(async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        await mkdir(path.join(FIXTURE_DIR, 'path with spaces'), { recursive: true });

        await Promise.all([
            buildTextPdf(fixtures.simpleText, {
                pages: ['Hello, SmythOS!'],
                title: 'Test PDF',
                author: 'Test Author',
                keywords: ['ai, test'],
            }),
            buildTextPdf(fixtures.multiPage, {
                pages: [
                    'Page one: alpha content',
                    'Page two: beta content',
                    'Page three: gamma content',
                ],
            }),
            buildTextPdf(fixtures.emptyPage, { pages: [''] }),
            buildTextPdf(fixtures.unicodeText, {
                pages: ['Caf\u00e9 r\u00e9sum\u00e9 na\u00efve \u00fcber Stra\u00dfe'],
            }),
            buildTextPdf(fixtures.metadataRich, {
                pages: ['Metadata test content'],
                title: 'Rich Metadata Title',
                author: 'Jane Doe',
                keywords: ['artificial intelligence, machine learning, nlp'],
                creationDate: new Date('2025-06-15T12:00:00Z'),
            }),
            buildTextPdf(fixtures.noMetadata, { pages: ['No metadata here'] }),
            buildImagePdf(fixtures.embeddedImage),
            writeFile(fixtures.notAPdf, 'This is plain text, not a PDF.'),
            buildTextPdf(fixtures.spacedPath, { pages: ['Spaced path content'] }),
        ]);
    }, 30_000);

    afterAll(async () => {
        await rm(FIXTURE_DIR, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    // 1. Output Structure Conformance
    // -----------------------------------------------------------------------

    describe('Output structure conformance', () => {
        let result: TParsedDocument;

        beforeAll(async () => {
            result = await parser.parse(fixtures.simpleText);
        });

        it('returns an object with title, metadata, and pages', () => {
            expect(result).toHaveProperty('title');
            expect(result).toHaveProperty('metadata');
            expect(result).toHaveProperty('pages');
        });

        it('title is a string', () => {
            expect(typeof result.title).toBe('string');
        });

        it('metadata has uri, author, date, and tags with correct types', () => {
            expect(typeof result.metadata.uri).toBe('string');
            expect(typeof result.metadata.author).toBe('string');
            expect(typeof result.metadata.date).toBe('string');
            expect(Array.isArray(result.metadata.tags)).toBe(true);
        });

        it('pages is a non-empty array', () => {
            expect(Array.isArray(result.pages)).toBe(true);
            expect(result.pages.length).toBeGreaterThan(0);
        });

        it('each page has a content array and a metadata object', () => {
            for (const page of result.pages) {
                expect(Array.isArray(page.content)).toBe(true);
                expect(typeof page.metadata).toBe('object');
                expect(page.metadata).not.toBeNull();
            }
        });

        it('content items have type and data as strings', () => {
            for (const page of result.pages) {
                for (const item of page.content) {
                    expect(typeof item.type).toBe('string');
                    expect(typeof item.data).toBe('string');
                }
            }
        });
    });

    // -----------------------------------------------------------------------
    // 2. Text Extraction Fidelity
    // -----------------------------------------------------------------------

    describe('Text extraction fidelity', () => {
        it('extracts known text from a single-page PDF', async () => {
            const result = await parser.parse(fixtures.simpleText);
            const text = extractAllText(result);
            expect(text).toContain('Hello');
            expect(text).toContain('SmythOS');
        });

        it('extracts correct text for each page in a multi-page PDF', async () => {
            const result = await parser.parse(fixtures.multiPage);
            const page1 = extractPageText(result.pages[0]);
            const page2 = extractPageText(result.pages[1]);
            const page3 = extractPageText(result.pages[2]);

            expect(page1).toContain('alpha');
            expect(page2).toContain('beta');
            expect(page3).toContain('gamma');

            // cross-page isolation: page-specific keywords should not leak
            expect(page1).not.toContain('beta');
            expect(page1).not.toContain('gamma');
        });

        it('produces no text content items for an empty page', async () => {
            const result = await parser.parse(fixtures.emptyPage);
            const textItems = result.pages[0].content.filter(c => c.type === 'text');
            expect(textItems.length).toBe(0);
        });

        it('preserves accented and special characters', async () => {
            const result = await parser.parse(fixtures.unicodeText);
            const text = extractAllText(result);
            expect(text).toContain('Caf');
            expect(text).toContain('sum');
            expect(text).toContain('ber');
            expect(text).toContain('Stra');
        });
    });

    // -----------------------------------------------------------------------
    // 3. Metadata Extraction
    // -----------------------------------------------------------------------

    describe('Metadata extraction', () => {
        it('extracts title from PDF metadata', async () => {
            const result = await parser.parse(fixtures.metadataRich);
            expect(result.title).toBe('Rich Metadata Title');
        });

        it('extracts author from PDF metadata', async () => {
            const result = await parser.parse(fixtures.metadataRich);
            expect(result.metadata.author).toBe('Jane Doe');
        });

        it('extracts creation date as a non-empty string', async () => {
            const result = await parser.parse(fixtures.metadataRich);
            expect(result.metadata.date.length).toBeGreaterThan(0);
            expect(result.metadata.date).toContain('2025');
        });

        it('parses keywords into tags array', async () => {
            const result = await parser.parse(fixtures.simpleText);
            expect(Array.isArray(result.metadata.tags)).toBe(true);
            expect(result.metadata.tags).toContain('ai');
            expect(result.metadata.tags).toContain('test');
        });

        it('falls back to filename when no title metadata is set', async () => {
            const result = await parser.parse(fixtures.noMetadata);
            expect(result.title).toBe('no-metadata');
        });

        it('returns empty defaults when no metadata fields are set', async () => {
            const result = await parser.parse(fixtures.noMetadata);
            expect(result.metadata.author).toBe('');
            expect(typeof result.metadata.date).toBe('string');
            expect(result.metadata.tags).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    // 4. Page Handling
    // -----------------------------------------------------------------------

    describe('Page handling', () => {
        it('returns correct number of pages', async () => {
            const result = await parser.parse(fixtures.multiPage);
            expect(result.pages.length).toBe(3);
        });

        it('assigns sequential page numbers starting from 1', async () => {
            const result = await parser.parse(fixtures.multiPage);
            result.pages.forEach((page, index) => {
                expect(page.metadata.pageNumber).toBe(index + 1);
            });
        });

        it('sets metadata.uri to the source file path', async () => {
            const result = await parser.parse(fixtures.simpleText);
            expect(result.metadata.uri).toBe(fixtures.simpleText);
        });
    });

    // -----------------------------------------------------------------------
    // 5. Image Detection
    // -----------------------------------------------------------------------

    describe('Image detection', () => {
        it('detects embedded images as content items with type image', async () => {
            const result = await parser.parse(fixtures.embeddedImage);
            const imageItems = result.pages.flatMap(
                p => p.content.filter(c => c.type === 'image'),
            );
            expect(imageItems.length).toBeGreaterThan(0);
        });

        it('image content items have data and text as strings', async () => {
            const result = await parser.parse(fixtures.embeddedImage);
            const imageItems = result.pages.flatMap(
                p => p.content.filter(c => c.type === 'image'),
            );

            for (const item of imageItems) {
                expect(typeof item.data).toBe('string');
                expect(typeof item.text).toBe('string');
            }
        });

        it('does not produce image items for text-only PDFs', async () => {
            const result = await parser.parse(fixtures.simpleText);
            const imageItems = result.pages.flatMap(
                p => p.content.filter(c => c.type === 'image'),
            );
            expect(imageItems.length).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // 6. Error Handling
    // -----------------------------------------------------------------------

    describe('Error handling', () => {
        it('rejects when given a non-existent file path', async () => {
            await expect(
                parser.parse('/nonexistent/path/to/file.pdf'),
            ).rejects.toThrow();
        });

        it('rejects when given a non-PDF file', async () => {
            await expect(
                parser.parse(fixtures.notAPdf),
            ).rejects.toThrow();
        });

        it('handles file paths with spaces', async () => {
            const result = await parser.parse(fixtures.spacedPath);
            expect(result.pages.length).toBeGreaterThan(0);
            const text = extractAllText(result);
            expect(text).toContain('Spaced');
        });
    });

    // -----------------------------------------------------------------------
    // 7. AutoParser Integration
    // -----------------------------------------------------------------------

    describe('AutoParser integration', () => {
        it('routes .pdf files through Doc.auto to the PDF parser', async () => {
            const autoResult = await Doc.auto.parse(fixtures.simpleText);

            expect(autoResult.title).toBeDefined();
            expect(autoResult.metadata.uri).toBe(fixtures.simpleText);
            expect(autoResult.pages.length).toBeGreaterThan(0);

            const text = extractAllText(autoResult);
            expect(text).toContain('Hello');
            expect(text).toContain('SmythOS');
        });
    });
});
