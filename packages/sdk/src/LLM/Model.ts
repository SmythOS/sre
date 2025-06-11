import { TCustomLLMModel, TLLMProvider, TLLMModel } from '@smythos/sre';

import { adaptModelParams } from './utils';
import { TLLMInstanceParams } from './LLMInstance.class';

/**
 * Model factory functions for each LLM provider.
 *
 * **Supported calling patterns:**
 * - `Model.provider(modelId, modelParams)` - specify model ID and optional parameters
 * - `Model.provider(modelParams)` - specify model ID within modelParams object
 *
 * @example
 * ```typescript
 * // Pattern 1: Explicit model ID
 * const model1 = Model.openai('gpt-4', { temperature: 0.7 });
 *
 * // Pattern 2: Model ID in params
 * const model2 = Model.openai({ model: 'gpt-4', temperature: 0.7 });
 * ```
 */
export type TModelFactory = {
    /**
     * Create a model with explicit model ID and optional parameters.
     *
     * @param modelId - The model identifier (e.g., `'gpt-4'`, `'claude-3-sonnet'`)
     * @param modelParams - Optional model parameters (temperature, maxTokens, etc.)
     * @returns Configured model object
     */
    (modelId: string, modelParams?: TLLMInstanceParams): any;

    /**
     * Create a model with parameters object containing model ID.
     *
     * @param modelParams - Model parameters including the required `model` field
     * @returns Configured model object
     */
    (modelParams: TLLMInstanceParams & { model: string | TLLMModel | TCustomLLMModel }): any;
};

const Model = {} as Record<TLLMProvider, TModelFactory>;

for (const provider of Object.keys(TLLMProvider)) {
    Model[provider] = ((modelIdOrParams: string | TLLMInstanceParams, modelParams?: TLLMInstanceParams): any => {
        if (typeof modelIdOrParams === 'string') {
            // First signature: (modelId: string, modelParams?: TLLMInstanceParams)
            return adaptModelParams({ model: modelIdOrParams, ...modelParams }, TLLMProvider[provider]).model;
        } else {
            // Second signature: (modelParams: TLLMInstanceParams)
            return adaptModelParams(modelIdOrParams, TLLMProvider[provider]).model;
        }
    }) as TModelFactory;
}

export { Model };
