// prettier-ignore-file
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TextParser } from '../../../src/DocParser/parsers/TextParser.class';
import { MarkdownParser } from '../../../src/DocParser/parsers/MarkdownParser.class';
import { DocParser, TParsedDocument } from '../../../src/DocParser/DocParser.class';
import { DocInstance } from '../../../src/DocParser/DocInstance.class';
// Import Doc and AutoParser from the SDK index to avoid circular dependency issues.
// AutoParser imports Doc.class (which imports AutoParser), so direct file imports
// can fail due to the circular reference. The index re-exports resolve this.
import { Doc, AutoParser } from '../../../src/index';
import * as fsPromises from 'fs/promises';
import path from 'path';

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

// ─── TextParser ─────────────────────────────────────────────────────────────────

describe('TextParser', () => {
    let parser: TextParser;

    beforeEach(() => {
        parser = new TextParser();
    });

    describe('parse() with raw string input', () => {
        it('should parse a simple string', async () => {
            const doc = await parser.parse('Hello, world!');
            expectValidDocument(doc);
            expect(doc.title).toBe('Untitled');
            expect(doc.metadata.uri).toBe('');
            expect(doc.pages).toHaveLength(1);
            expect(doc.pages[0].content).toHaveLength(1);
            expect(doc.pages[0].content[0].type).toBe('text');
            expect(doc.pages[0].content[0].data).toBe('Hello, world!');
            expect(doc.pages[0].content[0].text).toBe('Hello, world!');
            expect(doc.pages[0].metadata).toEqual({ pageNumber: 1 });
        });

        it('should parse a multi-line string', async () => {
            const input = 'Line one\nLine two\nLine three';
            const doc = await parser.parse(input);
            expectValidDocument(doc);
            // Multi-line strings contain newlines, so isLikelyFilePath returns false
            expect(doc.title).toBe('Untitled');
            expect(doc.metadata.uri).toBe('');
            expect(doc.pages[0].content[0].data).toBe(input);
        });

        it('should return empty content array for whitespace-only input', async () => {
            const doc = await parser.parse('   \n  \t  ');
            expectValidDocument(doc);
            expect(doc.pages[0].content).toHaveLength(0);
        });

        it('should return empty content array for empty string', async () => {
            const doc = await parser.parse('');
            expectValidDocument(doc);
            expect(doc.pages[0].content).toHaveLength(0);
        });
    });

    describe('parse() with settings', () => {
        it('should use provided title', async () => {
            const doc = await parser.parse('content', { title: 'My Title' });
            expect(doc.title).toBe('My Title');
        });

        it('should use provided author', async () => {
            const doc = await parser.parse('content', { author: 'John Doe' });
            expect(doc.metadata.author).toBe('John Doe');
        });

        it('should use provided date', async () => {
            const doc = await parser.parse('content', { date: '2025-01-01' });
            expect(doc.metadata.date).toBe('2025-01-01');
        });

        it('should use provided tags', async () => {
            const doc = await parser.parse('content', { tags: ['a', 'b'] });
            expect(doc.metadata.tags).toEqual(['a', 'b']);
        });

        it('should default metadata fields when no settings provided', async () => {
            const doc = await parser.parse('content');
            expect(doc.metadata.author).toBe('');
            expect(doc.metadata.date).toBe('');
            expect(doc.metadata.tags).toEqual([]);
        });

        it('should override inferred title with params.title', async () => {
            const doc = await parser.parse('some text', { title: 'Override Title' });
            expect(doc.title).toBe('Override Title');
        });
    });

    describe('parse() with file path input', () => {
        let tmpFile: string;

        beforeEach(async () => {
            tmpFile = path.join('/tmp', `test-textparser-${Date.now()}.txt`);
            await fsPromises.writeFile(tmpFile, 'File content here');
        });

        afterEach(async () => {
            try { await fsPromises.unlink(tmpFile); } catch {}
        });

        it('should read from a real file and use filename as title', async () => {
            const doc = await parser.parse(tmpFile);
            expectValidDocument(doc);
            const expectedTitle = path.basename(tmpFile, '.txt');
            expect(doc.title).toBe(expectedTitle);
            expect(doc.metadata.uri).toBe(tmpFile);
            expect(doc.pages[0].content[0].data).toBe('File content here');
        });

        it('should override file-based title with params.title', async () => {
            const doc = await parser.parse(tmpFile, { title: 'Custom' });
            expect(doc.title).toBe('Custom');
        });
    });
});

// ─── MarkdownParser ─────────────────────────────────────────────────────────────

describe('MarkdownParser', () => {
    let parser: MarkdownParser;

    beforeEach(() => {
        parser = new MarkdownParser();
    });

    describe('parse() with raw markdown', () => {
        it('should extract title from h1 heading', async () => {
            const doc = await parser.parse('# My Document\n\nSome content.');
            expectValidDocument(doc);
            expect(doc.title).toBe('My Document');
        });

        it('should extract title from setext-style h1', async () => {
            const doc = await parser.parse('My Title\n=======\n\nBody text.');
            expectValidDocument(doc);
            expect(doc.title).toBe('My Title');
        });

        it('should default to Untitled when no heading found', async () => {
            const doc = await parser.parse('Just plain text without headings.');
            expect(doc.title).toBe('Untitled');
        });

        it('should override extracted title with params.title', async () => {
            const doc = await parser.parse('# Original', { title: 'Override' });
            expect(doc.title).toBe('Override');
        });
    });

    describe('markdown content parsing', () => {
        it('should parse headings into heading content blocks', async () => {
            const md = '# Title\n\nParagraph.\n\n## Section\n\nMore text.';
            const doc = await parser.parse(md);
            const types = doc.pages[0].content.map(c => c.type);
            expect(types).toContain('heading');
            expect(types).toContain('text');
        });

        it('should parse code blocks', async () => {
            const md = '# Doc\n\n```\nconst x = 1;\n```';
            const doc = await parser.parse(md);
            const codeBlocks = doc.pages[0].content.filter(c => c.type === 'code');
            expect(codeBlocks.length).toBeGreaterThanOrEqual(1);
            expect(codeBlocks[0].data).toContain('const x = 1;');
        });

        it('should parse code blocks with language specifier', async () => {
            const md = '```typescript\nconst x: number = 1;\n```';
            const doc = await parser.parse(md);
            const codeBlocks = doc.pages[0].content.filter(c => c.type === 'code');
            expect(codeBlocks.length).toBe(1);
            expect(codeBlocks[0].data).toContain('const x: number = 1;');
        });

        it('should handle multiple headings at different levels', async () => {
            const md = '# H1\n\n## H2\n\n### H3\n\nContent.';
            const doc = await parser.parse(md);
            const headings = doc.pages[0].content.filter(c => c.type === 'heading');
            expect(headings.length).toBe(3);
            expect(headings[0].data).toBe('H1');
            expect(headings[1].data).toBe('H2');
            expect(headings[2].data).toBe('H3');
        });

        it('should handle setext-style h2 headings (dashes)', async () => {
            const md = 'Heading Two\n-----------\n\nBody.';
            const doc = await parser.parse(md);
            const headings = doc.pages[0].content.filter(c => c.type === 'heading');
            expect(headings.length).toBeGreaterThanOrEqual(1);
            expect(headings[0].data).toBe('Heading Two');
        });

        it('should handle empty markdown', async () => {
            const doc = await parser.parse('');
            expectValidDocument(doc);
            expect(doc.pages[0].content).toHaveLength(0);
        });

        it('should handle markdown with only whitespace', async () => {
            const doc = await parser.parse('   \n\n   ');
            expectValidDocument(doc);
            expect(doc.pages[0].content).toHaveLength(0);
        });

        it('should preserve text between headings', async () => {
            const md = '# Title\n\nFirst paragraph.\n\n## Section\n\nSecond paragraph.';
            const doc = await parser.parse(md);
            const textBlocks = doc.pages[0].content.filter(c => c.type === 'text');
            expect(textBlocks.length).toBeGreaterThanOrEqual(2);
            expect(textBlocks.some(t => t.data.includes('First paragraph.'))).toBe(true);
            expect(textBlocks.some(t => t.data.includes('Second paragraph.'))).toBe(true);
        });

        it('should handle multiple code blocks', async () => {
            const md = '```\nblock1\n```\n\ntext\n\n```\nblock2\n```';
            const doc = await parser.parse(md);
            const codeBlocks = doc.pages[0].content.filter(c => c.type === 'code');
            expect(codeBlocks.length).toBe(2);
            expect(codeBlocks[0].data).toBe('block1');
            expect(codeBlocks[1].data).toBe('block2');
        });
    });

    describe('metadata handling', () => {
        it('should set uri to empty for raw content', async () => {
            const doc = await parser.parse('# Hello\n\nWorld');
            expect(doc.metadata.uri).toBe('');
        });

        it('should set metadata from params', async () => {
            const doc = await parser.parse('# Hello', {
                author: 'Alice',
                date: '2025-06-01',
                tags: ['test', 'md'],
            });
            expect(doc.metadata.author).toBe('Alice');
            expect(doc.metadata.date).toBe('2025-06-01');
            expect(doc.metadata.tags).toEqual(['test', 'md']);
        });
    });

    describe('setext headings with preceding text blocks', () => {
        it('should flush text block before setext heading', async () => {
            const md = 'Some intro text here.\n\nSubheading\n-----------\n\nBody after setext.';
            const doc = await parser.parse(md);
            const blocks = doc.pages[0].content;
            const textBlocks = blocks.filter((c: any) => c.type === 'text');
            const headings = blocks.filter((c: any) => c.type === 'heading');
            expect(textBlocks.length).toBeGreaterThanOrEqual(1);
            expect(headings.length).toBeGreaterThanOrEqual(1);
            expect(textBlocks.some((t: any) => t.data.includes('Some intro text'))).toBe(true);
        });
    });

    describe('parse() with file path input', () => {
        let tmpFile: string;

        beforeEach(async () => {
            tmpFile = path.join('/tmp', `test-mdparser-${Date.now()}.md`);
            await fsPromises.writeFile(tmpFile, '# File Title\n\nContent from file.');
        });

        afterEach(async () => {
            try { await fsPromises.unlink(tmpFile); } catch {}
        });

        it('should read from a real file', async () => {
            const doc = await parser.parse(tmpFile);
            expectValidDocument(doc);
            expect(doc.title).toBe('File Title');
            expect(doc.metadata.uri).toBe(tmpFile);
        });

        it('should use filename as title when no heading in file', async () => {
            const noHeadingFile = path.join('/tmp', `no-heading-${Date.now()}.md`);
            await fsPromises.writeFile(noHeadingFile, 'Just some plain text without any headings.');
            try {
                const doc = await parser.parse(noHeadingFile);
                expectValidDocument(doc);
                expect(doc.title).toBe(path.basename(noHeadingFile, '.md'));
                expect(doc.metadata.uri).toBe(noHeadingFile);
            } finally {
                try { await fsPromises.unlink(noHeadingFile); } catch {}
            }
        });
    });
});

// ─── DocParser (base class) ─────────────────────────────────────────────────────

describe('DocParser (base class)', () => {
    it('should return a default empty document', async () => {
        const parser = new DocParser();
        const doc = await parser.parse('anything');
        expectValidDocument(doc);
        expect(doc.title).toBe('');
        expect(doc.pages[0].content[0].data).toBe('');
    });
});

// ─── DocInstance ─────────────────────────────────────────────────────────────────

describe('DocInstance', () => {
    it('should delegate parse() to the wrapped parser', async () => {
        const textParser = new TextParser();
        const instance = new DocInstance(textParser);
        const doc = await instance.parse('Hello from DocInstance', {});
        expectValidDocument(doc);
        expect(doc.pages[0].content[0].data).toBe('Hello from DocInstance');
    });

    it('should pass params through to the parser', async () => {
        const textParser = new TextParser();
        const instance = new DocInstance(textParser);
        const doc = await instance.parse('content', { title: 'Custom', author: 'Bob' });
        expect(doc.title).toBe('Custom');
        expect(doc.metadata.author).toBe('Bob');
    });

    it('should work with MarkdownParser', async () => {
        const mdParser = new MarkdownParser();
        const instance = new DocInstance(mdParser);
        const doc = await instance.parse('# Heading\n\nBody text.', {});
        expect(doc.title).toBe('Heading');
    });
});

// ─── Doc namespace ──────────────────────────────────────────────────────────────

describe('Doc namespace', () => {
    it('should expose auto, pdf, docx, md, text parsers', () => {
        expect(Doc).toHaveProperty('auto');
        expect(Doc).toHaveProperty('pdf');
        expect(Doc).toHaveProperty('docx');
        expect(Doc).toHaveProperty('md');
        expect(Doc).toHaveProperty('text');
    });

    it('should have parse methods on all parsers', () => {
        expect(typeof Doc.auto.parse).toBe('function');
        expect(typeof Doc.pdf.parse).toBe('function');
        expect(typeof Doc.docx.parse).toBe('function');
        expect(typeof Doc.md.parse).toBe('function');
        expect(typeof Doc.text.parse).toBe('function');
    });

    it('Doc.text should parse raw text', async () => {
        const doc = await Doc.text.parse('hello');
        expectValidDocument(doc);
        expect(doc.pages[0].content[0].data).toBe('hello');
    });

    it('Doc.md should parse markdown', async () => {
        const doc = await Doc.md.parse('# Title\n\nBody.');
        expectValidDocument(doc);
        expect(doc.title).toBe('Title');
    });
});

// ─── AutoParser ─────────────────────────────────────────────────────────────────

describe('AutoParser', () => {
    let parser: AutoParser;

    beforeEach(() => {
        parser = new AutoParser();
    });

    describe('raw text detection', () => {
        it('should fall back to TextParser for multi-line content', async () => {
            const doc = await parser.parse('This is plain text\nwith multiple lines.');
            expectValidDocument(doc);
            expect(doc.title).toBe('Untitled');
            expect(doc.pages[0].content[0].data).toBe('This is plain text\nwith multiple lines.');
        });

        it('should fall back to TextParser for very long strings', async () => {
            const longText = 'A'.repeat(1500);
            const doc = await parser.parse(longText);
            expectValidDocument(doc);
            expect(doc.pages[0].content[0].data).toBe(longText);
        });
    });

    describe('file extension detection', () => {
        let tmpTxt: string;
        let tmpMd: string;

        beforeEach(async () => {
            tmpTxt = path.join('/tmp', `auto-test-${Date.now()}.txt`);
            tmpMd = path.join('/tmp', `auto-test-${Date.now()}.md`);
            await fsPromises.writeFile(tmpTxt, 'Plain text content');
            await fsPromises.writeFile(tmpMd, '# Auto MD\n\nMarkdown body.');
        });

        afterEach(async () => {
            try { await fsPromises.unlink(tmpTxt); } catch {}
            try { await fsPromises.unlink(tmpMd); } catch {}
        });

        it('should auto-detect .txt files and use TextParser', async () => {
            const doc = await parser.parse(tmpTxt);
            expectValidDocument(doc);
            expect(doc.pages[0].content[0].data).toBe('Plain text content');
            // TextParser sets title from filename
            expect(doc.title).toBe(path.basename(tmpTxt, '.txt'));
        });

        it('should auto-detect .md files and use MarkdownParser', async () => {
            const doc = await parser.parse(tmpMd);
            expectValidDocument(doc);
            expect(doc.title).toBe('Auto MD');
        });
    });

    describe('fallback for unknown extensions', () => {
        let tmpFile: string;

        beforeEach(async () => {
            tmpFile = path.join('/tmp', `auto-test-${Date.now()}.xyz`);
            await fsPromises.writeFile(tmpFile, 'unknown format content');
        });

        afterEach(async () => {
            try { await fsPromises.unlink(tmpFile); } catch {}
        });

        it('should fall back to TextParser for unknown file extensions', async () => {
            const doc = await parser.parse(tmpFile);
            expectValidDocument(doc);
            expect(doc.pages[0].content[0].data).toBe('unknown format content');
        });
    });

    describe('settings passthrough', () => {
        it('should pass settings through to the delegate parser', async () => {
            const doc = await parser.parse('Some text\nwith lines', {
                title: 'Custom Title',
                author: 'Test Author',
                tags: ['auto'],
            });
            expect(doc.title).toBe('Custom Title');
            expect(doc.metadata.author).toBe('Test Author');
            expect(doc.metadata.tags).toEqual(['auto']);
        });
    });
});
