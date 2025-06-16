import { DocParser, TDocumentParseSettings } from './DocParser.class';

export class DocInstance {
    constructor(private _source: string, private _parser: DocParser, private _params: TDocumentParseSettings) {}

    async parse() {
        return await this._parser.parse();
    }
}
