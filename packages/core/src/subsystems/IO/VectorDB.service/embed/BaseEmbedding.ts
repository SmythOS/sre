import { IVectorDataSourceDto, Source } from '@sre/types/VectorDB.types';
import { isUrl } from '@sre/utils/index';
import { SupportedProviders } from 'index';
import { SupportedModels } from 'index';

export interface BaseEmbeddingParams {
    modelName: string;
    model: string;
    dimensions?: number;
    timeout?: number;
    chunkSize?: number;
    stripNewLines?: boolean;
    maxConcurrency?: number;
}

export type TEmbeddings = {
    provider: SupportedProviders;
    model: SupportedModels[SupportedProviders];
    dimensions?: number;
    credentials?: {
        apiKey: string;
    };
};

type SupportedSources = 'text' | 'vector' | 'url';

export abstract class BaseEmbedding implements Partial<BaseEmbeddingParams> {
    model: string;
    modelName: string;
    chunkSize = 512;
    stripNewLines = true;
    dimensions?: number;
    timeout?: number;
    maxConcurrency?: number;

    constructor(fields?: Partial<BaseEmbeddingParams>) {
        this.model = fields?.model ?? fields?.modelName ?? this.model;
        this.modelName = this.model;
        this.chunkSize = fields?.chunkSize ?? this.chunkSize;
        this.stripNewLines = fields?.stripNewLines ?? this.stripNewLines;
        this.timeout = fields?.timeout;
        this.dimensions = fields?.dimensions;
    }

    /**
     * Embed multiple texts and return their vector representations
     */
    abstract embedTexts(texts: string[]): Promise<number[][]>;

    /**
     * Embed a single text and return its vector representation
     */
    abstract embedText(text: string): Promise<number[]>;

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

    public transformSource(source: IVectorDataSourceDto[], sourceType: SupportedSources) {
        //* as the accepted sources increases, you will need to implement the strategy pattern instead of a switch case
        switch (sourceType) {
            case 'text': {
                const texts = source.map((s) => s.source as string);

                return this.embedTexts(texts).then((vectors) => {
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
}
