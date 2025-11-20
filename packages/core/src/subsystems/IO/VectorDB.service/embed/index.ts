import { OpenAIEmbeds } from './OpenAIEmbedding';
import { GoogleEmbeds } from './GoogleEmbedding';
import { TEmbeddings } from './BaseEmbedding';

// a factory to get the correct embedding provider based on the provider name
const supportedProviders = {
    OpenAI: {
        embedder: OpenAIEmbeds,
        models: OpenAIEmbeds.models,
    },
    GoogleAI: {
        embedder: GoogleEmbeds,
        models: GoogleEmbeds.models,
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

    public static getProviderByModel(model: SupportedModels): SupportedProviders {
        return Object.keys(supportedProviders).find((provider) => supportedProviders[provider].models.includes(model)) as SupportedProviders;
    }

    public static getModels() {
        return Object.keys(supportedProviders)
            .reduce((acc, provider) => {
                acc.push(
                    ...supportedProviders[provider].models.map((model) => ({
                        provider,
                        model,
                    }))
                );
                return acc;
            }, [] as { provider: SupportedProviders; model: SupportedModels[SupportedProviders] }[])
            .filter((item) => item.model !== 'text-embedding-ada-002'); //! SPECIAL case for ada-002, it doesn't support dimensions passing
    }
}
