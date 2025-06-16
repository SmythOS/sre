export type TDocumentParseSettings = {
    [key: string]: any;
};

export type TDocumentMetadata = {
    uri: string;
    author: string;
    date: string;
    tags: string[];
};

export type TDocumentContent = {
    type:
        | 'text'
        | 'image'
        | 'table'
        | 'code'
        | 'formula'
        | 'equation'
        | 'link'
        | 'list'
        | 'heading'
        | 'paragraph'
        | 'table'
        | 'image'
        | 'code'
        | 'formula'
        | 'equation'
        | 'link'
        | 'list'
        | 'heading'
        | 'paragraph';
    data: string;
    text?: string;
};

export type TDocumentPage = {
    content: TDocumentContent[];
    metadata: Record<string, any>;
};

export type TParsedDocument = {
    title: string;
    metadata: TDocumentMetadata;
    pages: TDocumentPage[];
};

export class DocParser {
    constructor(protected source: string, protected params?: TDocumentParseSettings) {}

    async parse(): Promise<TParsedDocument> {
        return {
            title: '',
            metadata: {
                uri: '',
                author: '',
                date: '',
                tags: [],
            },
            pages: [
                {
                    content: [
                        {
                            type: 'text',
                            data: '',
                            text: '',
                        },
                    ],
                    metadata: {},
                },
            ],
        };
    }
}
