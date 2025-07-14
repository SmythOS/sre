import { TCustomLLMModel, TLLMProvider, TLLMModel, models, SystemEvents } from '@smythos/sre';

import { adaptModelParams } from './utils';
import { TLLMInstanceParams } from './LLMInstance.class';
import { VectorDB } from '../VectorDB/VectorDB.class';
import { ControlledPromise, nGramSearch } from '../utils';

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

export function findClosestModelInfo(modelId: string) {
    if (models[modelId]) {
        return models[modelId];
    }
    const closestModelId = nGramSearch(modelId, Object.keys(models));
    if (closestModelId) {
        const modelInfo = JSON.parse(JSON.stringify(models[closestModelId]));
        modelInfo.enabled = true;
        modelInfo.modelId = modelId;
        modelInfo.credentials = ['internal', 'vault'];
        models[modelId] = modelInfo;
        return modelInfo;
    }
    return null;
}
// WIP : this is a workaround to ensure that the model info is available when the model is created
// if a model is not present we create an entry based on the closest model id

// const waitPromise = new ControlledPromise<any>(() => {});
// async function findModelInfo(modelId: string) {
//     await waitPromise;
//     const modelInfo = models[modelId];
//     if (modelInfo) {
//         return modelInfo;
//     }
//     const ramVec = VectorDB.RAMVec('models');

//     const results = await ramVec.search(modelId, { topK: 1 });
//     if (results.length > 0) {
//         const modelInfo = JSON.parse(JSON.stringify(models[results[0]?.text]));
//         modelInfo.enabled = true;
//         modelInfo.modelId = modelId;
//         models[modelId] = modelInfo;
//         return modelInfo;
//     }
//     return null;
// }

// SystemEvents.on('SRE:Initialized', async () => {
//     const ramVec = VectorDB.RAMVec('models');

//     await ramVec.purge();
//     const promises = [];
//     for (let modelId in models) {
//         promises.push(ramVec.insertDoc(modelId, modelId));
//     }
//     await Promise.all(promises);
//     waitPromise.resolve(true);
// });

export { Model };
