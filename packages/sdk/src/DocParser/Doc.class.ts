import { DocParser, TDocumentParseSettings } from './DocParser.class';
import { PDFParser } from './parsers/PDFParser.class';
import { DOCXParser } from './parsers/DOCXParser.class';
import { MarkdownParser } from './parsers/MarkdownParser.class';
import { TextParser } from './parsers/TextParser.class';

export const DocType = {
    PDF: 'PDF',
    DOCX: 'DOCX',
    MD: 'MD',
    TEXT: 'TEXT',
} as const;

export type TDocType = keyof typeof DocType;

const ParserMap: Record<TDocType, typeof DocParser> = {
    PDF: PDFParser,
    DOCX: DOCXParser,
    MD: MarkdownParser,
    TEXT: TextParser,
};

export type TDocParserFactory = {
    (source: string, params?: TDocumentParseSettings): DocParser;
};

export type TDocParserFactories = {
    [key in TDocType as Lowercase<key>]: TDocParserFactory;
};

const Doc = {} as TDocParserFactories;

for (const type of Object.keys(ParserMap) as TDocType[]) {
    const key = type.toLowerCase() as Lowercase<TDocType>;
    const ParserClass = ParserMap[type];
    Doc[key] = (source: string, params?: TDocumentParseSettings): DocParser => {
        return new ParserClass(source, params);
    };
}

export { Doc };
