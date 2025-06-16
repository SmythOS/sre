import { DocParser, TDocumentParseSettings } from '../DocParser.class';

export class TextParser extends DocParser {
    constructor(source: string, params?: TDocumentParseSettings) {
        super(source, params);
    }
}
