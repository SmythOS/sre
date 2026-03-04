import { IVectorDataSourceDto, Source } from '@sre/types/VectorDB.types';
import { isUrl } from '@sre/utils/index';
import { SupportedProviders, SupportedModels } from './index';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TLLMCredentials } from '@sre/types/LLM.types';

export type TEmbeddings = {
    provider?: SupportedProviders;
    model?: SupportedModels[SupportedProviders];

    credentials?:
        | TLLMCredentials
        | TLLMCredentials[]
        | {
              apiKey: string;
          };

    dimensions?: number;
    timeout?: number;
    chunkSize?: number;
    chunkOverlap?: number;
    batchSize?: number;
    stripNewLines?: boolean;

    params?: any;
};

type SupportedSources = 'text' | 'vector' | 'url';

export abstract class BaseEmbedding {
    model: string;
    modelName: string;
    chunkSize = 512;
    chunkOverlap = 100;
    stripNewLines = true;
    dimensions?: number;
    timeout?: number;
    batchSize = 10;

    constructor(fields?: Partial<TEmbeddings>) {
        this.model = fields?.model ?? this.model;
        this.chunkSize = fields?.chunkSize || fields?.params?.chunkSize || this.chunkSize;
        this.chunkOverlap = fields?.chunkOverlap || fields?.params?.chunkOverlap || this.chunkOverlap;
        this.stripNewLines = fields?.stripNewLines || fields?.params?.stripNewLines || this.stripNewLines;
        this.timeout = fields?.timeout || fields?.params?.timeout;
        this.dimensions = fields?.dimensions || fields?.params?.dimensions;
    }

    /**
     * Embed multiple texts and return their vector representations
     */
    abstract embedTexts(texts: string[], candidate: AccessCandidate): Promise<number[][]>;

    /**
     * Embed a single text and return its vector representation
     */
    abstract embedText(text: string, candidate: AccessCandidate): Promise<number[]>;

    /**
     * Utility method to chunk arrays into smaller batches
     */
    protected chunkArr<T>(arr: T[], sizePerChunk: number): T[][] {
        return arr.reduce((chunks, elem, index) => {
            const chunkIndex = Math.floor(index / sizePerChunk);
            const chunk = chunks[chunkIndex] || [];
            chunks[chunkIndex] = chunk.concat([elem]);
            return chunks;
        }, [] as T[][]);
    }

    public chunkText(text: string, { chunkSize, chunkOverlap }: { chunkSize?: number; chunkOverlap?: number }): string[] {
        const textSplitter = new TextSplitter({
            chunkSize: chunkSize ?? this.chunkSize,
            chunkOverlap: chunkOverlap ?? this.chunkOverlap,
        });
        return textSplitter.splitText(text);
    }
    /**
     * Utility method to process multiple texts based on stripNewLines setting
     */
    protected processTexts(texts: string[]): string[] {
        return this.stripNewLines ? texts.map((t) => t.replace(/\n/g, ' ')) : texts;
    }

    public detectSourceType(source: Source): SupportedSources | 'unknown' {
        if (typeof source === 'string') {
            return isUrl(source) ? 'url' : 'text';
        } else if (Array.isArray(source) && source.every((v) => typeof v === 'number')) {
            return 'vector';
        } else {
            return 'unknown';
        }
    }

    public transformSource(source: IVectorDataSourceDto[], sourceType: SupportedSources, candidate: AccessCandidate) {
        //* as the accepted sources increases, you will need to implement the strategy pattern instead of a switch case
        switch (sourceType) {
            case 'text': {
                const texts = source.map((s) => s.source as string);

                return this.embedTexts(texts, candidate).then((vectors) => {
                    return source.map((s, i) => ({
                        ...s,
                        source: vectors[i],
                        metadata: { ...s.metadata, text: texts[i] },
                    }));
                });
            }
            case 'vector': {
                return source;
            }
        }
    }

    // this is a dummy vector used to maximize search distance
    // we use it to create reserved vectors that store namespace data
    public get dummyVector(): number[] {
        //This is good for cosine similarity, but not for euclidean distance
        //TODO: detect current similarity metric and use the appropriate vector (e.g for euclidean distance, use a vector with all large values like [1e6, 1e6, ..., 1e6])
        return Array(this.dimensions - 1)
            .fill(0)
            .concat([1]);
    }
}

class TextSplitter {
    private chunkSize: number;
    private chunkOverlap: number;
    private separators: string[] = ['\n\n', '\n', ' ', ''];
    private keepSeparator: boolean = true;

    constructor({
        chunkSize = 1000,
        chunkOverlap = 200,
        separators,
        keepSeparator,
    }: {
        chunkSize?: number;
        chunkOverlap?: number;
        separators?: string[];
        keepSeparator?: boolean;
    } = {}) {
        this.chunkSize = chunkSize;
        this.chunkOverlap = chunkOverlap;

        if (separators) {
            this.separators = separators;
        }

        if (keepSeparator !== undefined) {
            this.keepSeparator = keepSeparator;
        }

        if (this.chunkOverlap >= this.chunkSize) {
            throw new Error('Cannot have chunkOverlap >= chunkSize');
        }
    }

    public splitText(text: string): string[] {
        return this._splitText(text, this.separators);
    }

    private _splitText(text: string, separators: string[]): string[] {
        const finalChunks: string[] = [];

        // Get appropriate separator to use
        let separator: string = separators[separators.length - 1];
        let newSeparators: string[] | undefined;

        for (let i = 0; i < separators.length; i += 1) {
            const s = separators[i];
            if (s === '') {
                separator = s;
                break;
            }
            if (text.includes(s)) {
                separator = s;
                newSeparators = separators.slice(i + 1);
                break;
            }
        }

        // Split the text using the identified separator
        const splits = this.splitOnSeparator(text, separator);

        // Process splits, recursively splitting longer texts
        let goodSplits: string[] = [];
        const _separator = this.keepSeparator ? '' : separator;

        for (const s of splits) {
            if (this.lengthFunction(s) < this.chunkSize) {
                goodSplits.push(s);
            } else {
                if (goodSplits.length) {
                    const mergedText = this.mergeSplits(goodSplits, _separator);
                    finalChunks.push(...mergedText);
                    goodSplits = [];
                }

                if (!newSeparators) {
                    finalChunks.push(s);
                } else {
                    const otherInfo = this._splitText(s, newSeparators);
                    finalChunks.push(...otherInfo);
                }
            }
        }

        if (goodSplits.length) {
            const mergedText = this.mergeSplits(goodSplits, _separator);
            finalChunks.push(...mergedText);
        }

        return finalChunks;
    }

    private splitOnSeparator(text: string, separator: string): string[] {
        let splits: string[];

        if (separator) {
            if (this.keepSeparator) {
                const regexEscapedSeparator = separator.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
                splits = text.split(new RegExp(`(?=${regexEscapedSeparator})`));
            } else {
                splits = text.split(separator);
            }
        } else {
            splits = text.split('');
        }

        return splits.filter((s) => s !== '');
    }

    private lengthFunction(text: string): number {
        return text.length;
    }

    private joinDocs(docs: string[], separator: string): string | null {
        const text = docs.join(separator).trim();
        return text === '' ? null : text;
    }

    private mergeSplits(splits: string[], separator: string): string[] {
        const docs: string[] = [];
        const currentDoc: string[] = [];
        let total = 0;

        for (const d of splits) {
            const _len = this.lengthFunction(d);

            if (total + _len + currentDoc.length * separator.length > this.chunkSize) {
                if (total > this.chunkSize) {
                    console.warn(`Created a chunk of size ${total}, which is longer than the specified ${this.chunkSize}`);
                }

                if (currentDoc.length > 0) {
                    const doc = this.joinDocs(currentDoc, separator);
                    if (doc !== null) {
                        docs.push(doc);
                    }

                    // Keep popping if conditions are met
                    while (total > this.chunkOverlap || (total + _len + currentDoc.length * separator.length > this.chunkSize && total > 0)) {
                        total -= this.lengthFunction(currentDoc[0]);
                        currentDoc.shift();
                    }
                }
            }

            currentDoc.push(d);
            total += _len;
        }

        const doc = this.joinDocs(currentDoc, separator);
        if (doc !== null) {
            docs.push(doc);
        }

        return docs;
    }
}
