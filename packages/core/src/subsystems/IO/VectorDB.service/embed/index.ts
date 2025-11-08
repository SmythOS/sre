import { OpenAIEmbeds } from './OpenAIEmbedding';
import { GoogleEmbeds } from './GoogleEmbedding';
import { TEmbeddings } from './BaseEmbedding';
import { TLLMModel } from '@sre/types/LLM.types';

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
    public static create(provider?: SupportedProviders, config?: TEmbeddings & { model?: SupportedModels[SupportedProviders] | TLLMModel }) {
        if (!provider) provider = 'OpenAI';
        if (!config) config = { provider: 'OpenAI', model: 'text-embedding-3-large', dimensions: 1024 };

        //if the model is a TLLMModel, we need to convert it to a SupportedModels[SupportedProviders]
        if (config.model && typeof config.model === 'object') {
            provider = (config.model as TLLMModel).provider as SupportedProviders;
            config.model = (config.model as TLLMModel).modelId;
        }

        return new supportedProviders[provider as SupportedProviders].embedder(config);
    }
}
