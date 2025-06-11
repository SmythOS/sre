import { OpenAIEmbeds } from './OpenAIEmbedding';
import { TEmbeddings } from './BaseEmbedding';

// a factory to get the correct embedding provider based on the provider name
const supportedProviders = {
    OpenAI: {
        embedder: OpenAIEmbeds,
        models: OpenAIEmbeds.models,
    },
} as const;

export type SupportedProviders = keyof typeof supportedProviders;
export type SupportedModels = {
    [K in SupportedProviders]: (typeof supportedProviders)[K]['models'][number];
};

export class EmbeddingsFactory {
    public static create(provider: SupportedProviders, config: TEmbeddings) {
        return new supportedProviders[provider].embedder(config);
    }
}
