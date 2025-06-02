export class TextSplitter {
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

    public async splitText(text: string): Promise<string[]> {
        return this._splitText(text, this.separators);
    }

    private async _splitText(text: string, separators: string[]): Promise<string[]> {
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
                    const mergedText = await this.mergeSplits(goodSplits, _separator);
                    finalChunks.push(...mergedText);
                    goodSplits = [];
                }

                if (!newSeparators) {
                    finalChunks.push(s);
                } else {
                    const otherInfo = await this._splitText(s, newSeparators);
                    finalChunks.push(...otherInfo);
                }
            }
        }

        if (goodSplits.length) {
            const mergedText = await this.mergeSplits(goodSplits, _separator);
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

    private async mergeSplits(splits: string[], separator: string): Promise<string[]> {
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

export class RecursiveTextSplitter extends TextSplitter {
    constructor({
        chunkSize = 1000,
        chunkOverlap = 200,
        separators = ['\n\n', '\n', ' ', ''],
        keepSeparator = true,
    }: {
        chunkSize?: number;
        chunkOverlap?: number;
        separators?: string[];
        keepSeparator?: boolean;
    } = {}) {
        super({ chunkSize, chunkOverlap, separators, keepSeparator });
    }
}
