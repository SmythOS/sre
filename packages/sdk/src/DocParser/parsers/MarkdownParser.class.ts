import { DocParser, TDocumentParseSettings } from '../DocParser.class';

export class MarkdownParser extends DocParser {
    constructor(source: string, params?: TDocumentParseSettings) {
        super(source, params);
    }
}
