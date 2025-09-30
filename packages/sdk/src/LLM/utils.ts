import { TLLMModel, TLLMProvider } from '@smythos/sre';
import { TLLMInstanceParams } from './LLMInstance.class';
import { findClosestModelInfo } from './Model';

export function adaptModelParams(
    modelSettings: TLLMInstanceParams,
    fallbackProvider?: TLLMProvider,
    defaultSettings?: TLLMModel
): TLLMInstanceParams {
    const { model, provider, baseURL, inputTokens, outputTokens, interface: interfaceType, features, ...params } = modelSettings;
    const modelObject: any = {
        provider: provider || fallbackProvider,
        modelId: model as string, // for backward compatibility
        model: model as string, // for backward compatibility
        interface: interfaceType,
        features: features,
        baseURL: baseURL,
        tags: ['sdk'],
        tokens: inputTokens || defaultSettings?.keyOptions?.tokens || defaultSettings?.tokens,
        completionTokens: outputTokens || defaultSettings?.keyOptions?.completionTokens || defaultSettings?.completionTokens,
    };

    modelObject.params = params;

    if (typeof modelObject?.params?.apiKey === 'string') {
        //all keys are handled in credentials object internally
        modelObject.credentials = { apiKey: modelObject?.params?.apiKey } as any;
        delete modelObject?.params?.apiKey;
    }

    if (!modelObject.credentials) {
        modelObject.credentials = ['vault'] as any;
    }

    return { model: modelObject };
}
