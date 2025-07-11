import { TLLMProvider } from '@smythos/sre';
import { TLLMInstanceParams } from './LLMInstance.class';

export function adaptModelParams(modelSettings: TLLMInstanceParams, fallbackProvider?: TLLMProvider): TLLMInstanceParams {
    const { model, provider, inputTokens, outputTokens, ...params } = modelSettings;
    const modelObject: any = {
        provider: provider || fallbackProvider,
        modelId: model as string, // for backward compatibility
        model: model as string, // for backward compatibility
        tokens: inputTokens || 4096,
        completionTokens: outputTokens,
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
